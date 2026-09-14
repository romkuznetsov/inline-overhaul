function err(msg) {
  throw new Error('[tagwheel] ' + msg)
}

/*
 * Свои модули — литеральным `require`, по одному на модуль (У-89).
 *
 * Было: `loadCoreHelperFromGlobalOrRequire(ключ, путь)` — сначала смотрит
 * глобальную переменную, потом делает `require` **по переменной**. В сборке
 * путь в переменной не разрешается никогда, значит работала только первая
 * половина, а из восьми ключей кто-то ставит **три**:
 * `__inlineOverhaulSharedUtils`, `__inlinePkmRulesHelpers`,
 * `__inlineStatusLineRuntimeUnified`. Остальные пять не ставит никто, и в
 * установленном плагине эти пять геттеров отдавали `null` всегда.
 *
 * Что при этом работало: у каждого места вызова стояла своя копия логики
 * рядом. То есть вынесение пяти модулей в сборке не действовало, а работали
 * копии — при зелёном наборе, потому что в дереве исходников путь
 * `../../src/core/...` разрешается всегда. Тот же класс, что дефект A33.
 *
 * Копии стали недостижимы и снимаются следующим шагом: недостижимая
 * заплатка, похожая на страховку, — это У-90.
 */
var __sharedUtils = require('../../src/core/shared_utils.js')
var __statusLineRuntimeUnified = require('../../src/core/status_line_runtime_unified.js')
var __rulesRuntimeHelpers = require('../../src/core/pkm_rules_runtime_helpers.js')
var __tokenGraphUnified = require('../../src/core/token_graph_unified.js')
var __pkmDomainRegistry = require('../../src/core/pkm_domain_registry.js')
var __statusRuntimeCommonMod = require('../../src/core/status_runtime_common.js')
var __linePipeline = require('../../src/core/line_pipeline.js')

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

/*
 * Разбора служебного файла правил здесь больше нет (PRD 10.13.52, П-8, шаг
 * третий, 2026-09-13). Правила приезжают к панели из настроек — ключом
 * `Rules data`, который кладёт слой команд, — и вместе с
 * `parseRulesFromMarkdown` отсюда ушли разбор JSON-блоков и досыпка формы
 * списка Fields: у файла не осталось ни одного читателя в продукте.
 *
 * **Досыпка формы при этом жива** — `normalizeMode` в
 * `src/core/tagwheel_rules_normalizer.js`, — но зовёт её теперь один
 * `buildRulesForEngines` (`src/core/pkm_rules_shape.js`): то есть ход через
 * диск был единственным, кто добавлял её здесь. Второй копии не завелось
 * (У-32).
 */

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

/*
 * Правило живёт в общем модуле, и здесь его зовут прямо. Прежде за вызовом
 * лежала своя копия, охраняемая одним `if`: доставалась она, только если
 * общая реализация бросила, и тогда молча отвечала иначе (У-32). Сторож
 * долга Д-4 её не видел — он ищет пустой `catch`, а здесь его нет.
 */
function getSubtagFormat(rules) {
  return ensureStatusRuntimeCommonFns().resolveSubtagFormat(null, rules)
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

/*
 * Здесь лежали `isLikelyDatesSegment` и `isLikelyRightPayloadSegment` — две
 * копии правила «что в этом куске строки правый груз, а что текст».
 * Объявлено оно в `line_pipeline.js` (`isLikelyRightPayloadToken` и
 * `isMarkerAnchoredDatePayloadTokens`), и звал копии только разбор строки.
 * Разбор спрашивает границы зон у общего объявления с 2026-09-12, и копии
 * стали недостижимы: недостижимая заплатка, похожая на страховку, — это
 * У-90.
 */
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

/**
 * Положить в правила выбор человека «на каком Field открывать панель».
 *
 * Настройка едет к движку ключами (10.13.76), а движок читает **правила** —
 * тем же приёмом, каким в них кладётся порядок Fields. Пустое значение ничего
 * не портит: режим по умолчанию `first`, то есть прежнее поведение.
 */
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
 * Какое поле панели ведущее при её открытии — по выбору человека.
 *
 * `first` — первое из видимых, прежнее поведение и умолчание.
 * `middle` — ближе к середине, со смещением влево: формула его же словами,
 * индекс `ceil(n / 2) - 1`. Два поля дают первое, три — второе, четыре —
 * второе, пять — третье.
 * `custom` — названное им поле своего Block.
 *
 * Считается по **видимым** полям, а не по списку правил: список разложен по
 * типу, а человек видит свой Order, и середина у этих двух множеств разная
 * (10.13.69, Т-8).
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
  /*
   * `first` обязан быть **ответом**, а не молчанием. Пока он молчал, решал
   * первый попавшийся старый ключ правил, и человек видел в настройках
   * «первое поле Block», а панель открывалась на другом (`S5` 2026-09-12).
   */
  return String(list[0] || '')
}

function resolveInitialActiveField(rules, state, modeName) {
  var mode = getMode(rules, modeName)
  if (!mode.fields.length) return 0

  /*
   * **Активным может быть только то, что человек видит** (замечание заказчика
   * 2026-09-11, воспроизведено на его конфиге 2026-09-12).
   *
   * Панель показывает поля по Order, а активное поле выбиралось индексом в
   * списке по **типу** — теги в одном, ссылки и элементы в другом. Два разных
   * множества, и индекс одного применялся к другому:
   *
   *   панель слева    элемент-дата, важность, тип   — порядок человека
   *   список по типу  важность, её дочерний, тип    — элемента-даты в нём нет
   *   активное поле   индекс 0 → по типу это важность
   *
   * Он так и написал: «активное поле было imp, а не Due». В правом Block было
   * хуже: индекс уходил **за край** отрисованного списка — 2 при двух видимых.
   *
   * Поэтому там, где поле **никто не назвал**, оно берётся из самой панели —
   * первое из тех, что человек видит.
   *
   * **А названное настройкой поле остаётся за ней**, даже если панель его сейчас
   * не рисует. Первая версия этой правки отвергала и его — и уронила проверку,
   * где ведущее поле задано нарочно: настройка на то и настройка. Граница
   * прошла здесь: догадка спрашивает панель, явный выбор — нет (У-33).
   *
   * (Имена полей здесь нарочно словами: сторож канонических ключей не отличает
   * код от рассказа о коде и краснеет на примере в комментарии.)
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

  /*
   * **Выбор человека спрашивается первым** (10.13.76). До 2026-09-12 первым
   * стоял ключ `behavior.order.lead`, и писать его было некому: функция
   * записи не звалась ниоткуда (10.13.69, Т-5). Ключ остаётся ниже — у кого
   * он проставлен руками, тот его и получит, — но теперь у настройки есть
   * контрол, и он сильнее.
   */
  var chosenId = chooseActiveFieldId(rules, modeName, visible)
  var chosenIsNamed = activeFieldChoiceMode(rules) === 'custom'
  /*
   * **Названное поле сильнее посчитанного.** Порядок такой: поле, названное
   * контролом (`A Field you choose`), потом поле, названное в правилах ключом
   * `lead`, и только потом посчитанное — первое или среднее. Иначе правило
   * «взять первое» отменяло бы прямое указание человека (У-33).
   */
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
    /*
     * Поле человек видит, а в списке по типу его нет: элемент лежит среди
     * правых, даже когда по Order он слева. Тот же случай, что у первого
     * видимого ниже, и ответ тот же — решает имя, а не место в списке
     * (10.13.69, Т-8). Без этого выбор «названное поле» молча не
     * срабатывал бы ровно на элементах.
     */
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
 * Разбор строки: где проходят границы зон, спрашивается у `line_pipeline`.
 *
 * **Здесь стояло второе объявление того же правила** — свой поиск первого
 * разделителя, за ним второго, и свои ветки «что считать правым грузом». Общее
 * объявление за это время научилось строке, у которой заполнен **только**
 * правый Block (`-  :: 👤111`): первого разделителя в ней нет, и правый Block
 * отделяется вторым (исключения 45 и 62 к З3). Копия этого не знала и объявляла
 * текстом человека всё вместе с разделителем.
 *
 * Что это давало заказчику (замечание 2026-09-12): панель, открытая на строке,
 * которую плагин **сам только что написал**, не узнавала в ней ни одного
 * значения и показывала их текстом. Причём «написал сам» тут буквально: команда
 * поля правого Block на пустой строке пишет ровно такую строку.
 *
 * Это У-150 ещё раз: правило чинилось в одном объявлении из двух, и пути
 * разошлись **по-разному** — команда значение узнавала, панель нет.
 *
 * Своего у разбора остаётся то, чего в общем правиле нет и быть не должно:
 * знак заголовка, знак списка, чекбокс и раскладка левого сегмента на теги,
 * значения элементов и текст.
 */
function parseLine(rawLine, rules) {
  var line = String(rawLine || '')
  var seg = __linePipeline.splitSegments(line, rules)
  var indent = String(seg && seg.indent || '')
  var leftBody = String(seg && seg.left || '').trim()

  /*
   * **Знак начала строки спрашивается у общего правила, а не у своих образцов**
   * (2026-09-13, 10.13.94). Здесь стояло третье объявление того же: свой поиск
   * заголовка, за ним свой знак списка, за ним свои скобки чекбокса. Каждое
   * расходилось с общим по-своему:
   *
   *   - заголовок требовал пробела за решётками, а левый сегмент приходит
   *     обрезанным — у строки `#### [ ] test` он равен `####`, и заголовок не
   *     узнавался вовсе;
   *   - скобки снимались как чекбокс и за знаком заголовка — а у Obsidian
   *     задача это скобки за знаком **списка**, и `#### [ ] test` есть
   *     заголовок с текстом `[ ] test`. Скобки человека из строки пропадали
   *     (тот же класс, что У-91).
   *
   * Общее правило — `splitLeftPrefix` в `line_pipeline.js`, и оно же отвечает
   * на этот вопрос всем остальным.
   */
  /*
   * **Части начала строки берутся у общего объявления, а не разбираются
   * заново** (10.13.118). Здесь стоял свой образец: он не знал ни цитаты, ни
   * номера со скобкой, и всё, чего он не узнал, уезжало в зону значений —
   * `> текст` после шага по полю переставала быть цитатой (В-115).
   */
  var lineStart = __sharedUtils.lineStartOf(leftBody)
  var headingToken = String(lineStart.heading || '').trim()
  var bulletToken = String(lineStart.marker || '').trim()
  var checkboxToken = String(lineStart.checkbox || '').trim()
  /* Цитату `splitSegments` уже сняла отступом — оттуда её и берём, тем же
     одним объявлением: в левом сегменте её больше нет. */
  var indentStart = __sharedUtils.lineStartOf(indent)
  var quoteToken = String(lineStart.quote || '') + String(lineStart.callout || '')
    || (String(indentStart.quote || '') + String(indentStart.callout || ''))
  if (lineStart.at > 0) leftBody = String(lineStart.body || '')

  /*
   * Что в левом сегменте тег, что значение элемента, а что текст человека.
   *
   * `values` — те же токены, что попали в `tags` и `dates`, но **в том порядке,
   * в каком они стоят в строке**. Это левый Block как он есть; корзины `tags` и
   * `dates` отвечают на другой вопрос — «что за значение», а не «где оно
   * стоит», — и по Block их разложить уже нельзя (см. возврат `parseLine`).
   */
  function classifyLeftPartTokens(raw) {
    var src = String(raw || '').trim()
    var out = { tags: [], dates: [], text: [], values: [] }
    if (!src) return out
    var parts = src.split(/\s+/)
    var i
    for (i = 0; i < parts.length; i++) {
      var t = String(parts[i] || '').trim()
      if (!t) continue
      if (__sharedUtils.isTagToken(t) || __sharedUtils.isWikilinkToken(t)) {
        out.tags.push(t)
        out.values.push(t)
        continue
      }
      if (isDateLikeToken(t, rules)) {
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
   * **Две пары полей, и вопросы у них разные.**
   *
   * `tags` и `dates` — корзины **узнавания**: что из строки вообще является
   * значением и какого рода. Значение-элемент, стоящее слева (`📅…`, `👤111`),
   * ложится в `dates` вместе с правым грузом — иначе панель его не узнает
   * вовсе. То есть по Block эти две корзины не разложены и разложены быть не
   * могут.
   *
   * `left` и `right` — сами Block, как они стоят в строке. Прежде здесь лежали
   * `tags.slice()` и `dates`, то есть имена обещали Block, а значение несли от
   * корзин, и читателя у них не было ни одного. Читатель появился с режимом
   * «не прятать противоположный Block» (10.13.87) — и получил ровно эту ложь:
   * дата из левого Block приезжала на экран справа, а при открытии панели
   * справа пропадала совсем (замечание заказчика 2026-09-13 к строке `S27`).
   */
  return {
    indent: indent,
    headingToken: headingToken,
    /* Цитата и каллаут — тоже начало строки, и их место **впереди** нашего
       знака: значение между `>` и `[!note]` каллаут разваливает (В-115). */
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
  var parts = s.split(/\s+/)
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
  /* Предусловие объявлено один раз — в `pkm_rules_runtime_helpers.js`, — и
     его же спрашивают команды поля. Здесь стояла копия, и командам она была
     недоступна: на пустой строке панель поле прятала, а команда писала
     значение (обход строки 2026-09-12). */
  return __rulesRuntimeHelpers.isFieldPrerequisiteMet(field, state && state.selected)
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
  throw new Error('shared_utils unavailable: normalizeFormatMask')
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

/*
 * Правило живёт в общем модуле, и здесь его зовут прямо. Прежде за вызовом
 * лежала своя копия, охраняемая одним `if`: доставалась она, только если
 * общая реализация бросила, и тогда молча отвечала иначе (У-32). Сторож
 * долга Д-4 её не видел — он ищет пустой `catch`, а здесь его нет.
 */
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
  throw new Error('shared_utils unavailable: buildCustomPlanFromIncrement')
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

/**
 * Что положить в сессию по значению элемента, стоящему на строке.
 *
 * **Дефект, ради которого это одна функция** (замечание заказчика 2026-09-07).
 * Значение элемента хранится в сессии смещением от «сегодня»: так его умеет
 * прокручивать стрелка. Смещение ищется перебором — сегодня, завтра, и так до
 * предела, — и значение, которого в этом ряду нет, не находилось **никак**.
 * Тогда в сессию не попадало ничего, а правую часть строки TagWheel собирает
 * заново, из сессии: она просто исчезала.
 *
 * Поймать это было легко на любой строке заказчика: у его Due формат
 * `YYYY-MM-DD hh:mm`, единица перебора — минута, а ряд идёт **вперёд**. Дата,
 * записанная хотя бы минуту назад, смещением не выражается никогда:
 *
 *   было      `- 11 :: 📅2026-09-07 11:34`, выбрать `#todo` в левом Block
 *   получено  `- [ ] #todo :: 11`
 *   ждали     `- [ ] #todo :: 11 :: 📅2026-09-07 11:34`
 *
 * Та же строка через команду `Field next` правую часть сохраняла: два хода
 * отвечали на один вопрос по-разному.
 *
 * **Правило теперь одно: значение, которое не выражается смещением, остаётся
 * собой.** Обратный ход у сырого значения уже есть — `buildDateLikeTokenByOffset`
 * при нечисловом отдаёт `маркер + текст`, — и этим же путём давно ходит
 * значение команды `randome`. Прокрутка сырого значения ведёт себя как прежде:
 * вверх ставит «сейчас», вниз очищает.
 *
 * Предел перебора спрашивается у `getSearchLimitByUnit`, а не пишется числом:
 * два места считали его по-разному — здесь `3660` при любой единице, там по
 * единице формата, — и это было второе объявление одного правила (У-32).
 *
 * Двадцать восьмое исключение к З3, разрешение заказчика 2026-09-07.
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
    if (progress !== null && isFinite(progress)) return String(Math.max(0, Math.trunc(progress)))
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

/*
 * Правило живёт в общем модуле, и здесь его зовут прямо. Прежде за вызовом
 * лежала своя копия, охраняемая одним `if`: доставалась она, только если
 * общая реализация бросила, и тогда молча отвечала иначе (У-32). Сторож
 * долга Д-4 её не видел — он ищет пустой `catch`, а здесь его нет.
 */
function detectDateUnit(format) {
  return ensureStatusRuntimeCommonFns().detectDateUnit(format, getSharedUtils())
}

/*
 * Правило живёт в общем модуле, и здесь его зовут прямо. Прежде за вызовом
 * лежала своя копия, охраняемая одним `if`: доставалась она, только если
 * общая реализация бросила, и тогда молча отвечала иначе (У-32). Сторож
 * долга Д-4 её не видел — он ищет пустой `catch`, а здесь его нет.
 */
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
  if (__sharedUtils.isWikilinkToken(tokenRaw)) return tokenRaw
  if (__sharedUtils.startsWithTagToken(tokenRaw)) return tokenRaw
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
    return { hidden: true, active: false, text: '', tokens: [] }
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
    text: text,
    /*
     * Сами значения, которые ячейка показывает, — не склеенная подпись.
     * Нужны тому, кто рисует **противоположный** Block: значение, взятое
     * полосой себе, не должно вторым экземпляром стоять в строке рядом.
     */
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

function renderControlLine(rules, state, parsedLine) {
  var mode = getMode(rules, state.mode)
  var groups = getRenderedGroupsForMode(rules, state, mode)

  var cells = []
  var shownTokens = []
  var gi
  for (gi = 0; gi < groups.length; gi++) {
    var g = groups[gi]
    var disp = buildGroupDisplay(g, mode, state, rules)
    if (disp.hidden) continue
    if (disp.active) cells.push('**[' + disp.text + ']**')
    else cells.push(disp.text)
    if (Array.isArray(disp.tokens)) shownTokens = shownTokens.concat(disp.tokens)
  }

  var tail = parsedLine.text || ''
  var head = cells.join(' ')
  var panelCfg = rules.ui && rules.ui.activePanel ? rules.ui.activePanel : null
  var keepOpposite = false
  if (panelCfg && panelCfg.enabled !== false) {
    var useHighlight = panelCfg.useHighlight === true
    var showMarkers = panelCfg.showMarkers === true
    var pfx = typeof panelCfg.prefix === 'string' ? panelCfg.prefix : '{TW}'
    var sfx = typeof panelCfg.suffix === 'string' ? panelCfg.suffix : '{/TW}'
    if (showMarkers) head = pfx + ' ' + head + ' ' + sfx
    if (useHighlight) head = '==' + head + '=='
    keepOpposite = panelCfg.keepOppositeBlock === true
  }

  /*
   * **Противоположный Block: прятать или оставить на виду** (10.13.87, заказ
   * заказчика 2026-09-12). Полоса встаёт на место своего Block; второй уходил
   * из строки на всё время выбора, даже если значения в нём уже стояли.
   *
   * Берётся он из `parsedLine`, снятого при открытии, а не из строки на
   * экране: на экране лежит вид панели, и чтение оттуда дописывало бы
   * противоположный Block на каждое нажатие (У-157).
   *
   * **И берётся он из полей `left`/`right`, а не из корзин `tags`/`dates`.**
   * Корзины отвечают на «что это за значение», Block они не знают: первая
   * версия читала их, и значение-элемент из левого Block приезжало на экран
   * справа, а при открытии панели справа пропадало из строки совсем. Разбор
   * этого — в шапке возврата `parseLine`.
   *
   * Текста человека это не касается: он на месте в обоих режимах.
   */
  var other = ''
  if (keepOpposite) {
    other = state.mode === 'right'
      ? String(parsedLine.left || '').trim()
      : String(parsedLine.right || '').trim()
    /*
     * **Взятое полосой в строке вторым экземпляром не остаётся.** Место
     * значения в строке и Block его Field — разные вещи: значение поля правой
     * панели человек мог написать слева, и наоборот. Полоса показывает такое
     * значение своей ячейкой, а Block, из которого оно взято, — это
     * противоположный Block, и без уборки человек видит его дважды.
     *
     * Убирается точным токеном, тем же помощником, что и у команд
     * (`removeExactTokens`): своего правила «как снять значение из зоны» здесь
     * заводить нельзя (У-32).
     */
    if (other && shownTokens.length && __linePipeline && typeof __linePipeline.removeExactTokens === 'function') {
      other = String(__linePipeline.removeExactTokens(other, shownTokens) || '').trim()
    }
  }

  /*
   * Сборка строки панели — **одна на все случаи**, и это не `joinLineParts`.
   * У полосы своё правило, которого общая сборка не знает и знать не должна:
   *
   *   - **разделитель у полосы стоит всегда**, даже когда остальная строка
   *     пуста (замечание заказчика 2026-09-12: «при открытии в пустой строке
   *     правого блока слева от него показывает сепаратор, а при открытии
   *     левого блока справа не возникает — хочу, чтобы возникал»);
   *   - **знака начала строки в полосе нет вовсе** — его возвращает
   *     `withKeptPrefix` в `tagwheel.js`, а `joinLineParts` ждёт его в левой
   *     зоне.
   *
   * Зоны идут слева направо; полоса стоит в зоне своего Block. Разделитель
   * появляется ровно там, где в его зоне что-то есть, а пустой слот текста
   * между двумя занятыми зонами — два пробела, как и у обычной строки.
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
  /*
   * Здесь нужна корзина узнавания, а не правый Block: в неё сложены **все**
   * значения-элементы строки, в том числе стоящие слева. Прежде стояло
   * `parsedLine.right || parsedLine.dates`, и это работало только потому, что
   * `right` был копией `dates`; с тех пор `right` стал правым Block, и порядок
   * пришлось назвать явно.
   */
  var rightRaw = String(parsedLine.dates || parsedLine.right || '')
  /* Разделитель берётся у настроек и только у них: запасное `||` собирало
     строку для графа токенов чужим знаком, и у человека со своим разделителем
     граф получал строку, которой на экране нет (У-186). */
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
        /*
         * **Поле, которым панель не управляет, она и не чистит.**
         *
         * Здесь стояло `state.selected[field.id] = ''`, и стоило это
         * написанного человеком. Цепочка: Field с невыполненным предусловием
         * панель прячет; разбор строки его значение **узнаёт** и кладёт в
         * состояние; эта строка выбор стирает; а дальше пустой выбор у поля,
         * ведомого источником, значит «человек вышел из цикла», и
         * перекладывание вычищает набор его токенов из строки (Н-5). У
         * заказчика `Project` ждёт `Category`, и на строке без Category
         * ссылка `[[test1]]` пропадала с первого же применения панели —
         * при том что команда того же поля строку не трогала.
         *
         * Предусловие решает, можно ли поле **менять** панелью, а не
         * выживет ли написанное. Выбор, который стал недопустимым по
         * значению, стирается ниже — это другой вопрос и он остался.
         */
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

/*
 * Экранирование объявлено в общем модуле. Копия, стоявшая здесь, писала
 * `String(s || '')` вместо `String(nz(s, ''))` — и на входах `0`, `false` и
 * `NaN` отвечала пустой строкой там, где общий модуль отвечает `"0"`,
 * `"false"` и `"NaN"`. Ветка была недостижима, модуль приезжает литеральным
 * `require`; расхождение измерено ревизией 2026-09-11 и показывает цену копий.
 */
function escapeRe(s) {
  var su = getSharedUtils()
  if (su && typeof su.escapeRe === 'function') return su.escapeRe(s)
  throw new Error('shared_utils unavailable: escapeRe')
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
  parseLine: parseLine,
  makeInitialState: makeInitialState,
  resolveInitialActiveField: resolveInitialActiveField,
  applyActiveFieldChoiceToRules: applyActiveFieldChoiceToRules,
  chooseActiveFieldId: chooseActiveFieldId,
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
