"use strict";

/*
 * Модуль берётся литеральным `require`, без заглушки за ним: он лежит в
 * бандле, и «не приехал» — состояние, которого не бывает (У-89, У-90).
 * Прежние две запасные ветки были не страховкой, а вторым ответом на тот же
 * вопрос: последняя отвечала «ключ равен самому себе», то есть при отказе
 * модуля дочерний Field молча терял своё место в Order. А ветка перед ней
 * читала `globalThis.__inlinePkmDomainRegistry`, которую **никто не пишет**.
 */
const __pkmDomainRegistry = require("./pkm_domain_registry.js");
const __sharedUtils = require("./shared_utils.js");

/*
 * **Ключ дочернего поля сворачивает реестр доменов, и только он** (10.13.161).
 *
 * Здесь стояло своё тело за запасным ходом: спросить реестр, а если его нет —
 * свернуть `_sub` самому. Плюс поправка «реестр ответил тем же ключом — значит
 * не свернул, свернём мы». Ни то, ни другое не исполняется: реестр приезжает
 * литеральным `require` на уровне модуля, а свой ответ он всегда сворачивает.
 * Проверено пробоем: отказ в обеих ветках не уронил ни одной проверки и ни
 * одного сочетания обхода строки (У-146), при том что сама функция
 * исполняется.
 *
 * Держал их **пин по тексту** — `assertTrue(/…/.test(src))`, — а он не
 * спрашивает, доходит ли до строки исполнение (У-141). Заменён ожиданием
 * ответа.
 */
function collapseSubOrderKey(key) {
  if (!__pkmDomainRegistry || typeof __pkmDomainRegistry.collapseSubOrderKey !== "function") {
    throw new Error("pkm_domain_registry unavailable: collapseSubOrderKey");
  }
  return __pkmDomainRegistry.collapseSubOrderKey(key);
}

function getFieldSourceValue(fieldOrSource) {
  if (typeof fieldOrSource === "string") return String(fieldOrSource || "").trim();
  return String(fieldOrSource && fieldOrSource.source || "").trim();
}

function normalizeFieldSourceKind(fieldOrSource) {
  const source = getFieldSourceValue(fieldOrSource);
  if (!source) return "none";
  if (source === "projects") return "projects";
  if (source.indexOf("wikilinks:") === 0) return "wikilinks";
  return "tag";
}

/**
 * Каким выводом печатается это поле — тег или ссылка. **Одно объявление на
 * все три дороги.**
 *
 * До 2026-09-15 вопрос был объявлен трижды: у панели (`tagwheel.js`), у ядра
 * (`tagwheel_core.js`) и замыканием внутри `buildTagTokenKeyMap` здесь же.
 * Три тела сверены на 150 парах «поле × правила» — все поля его `data.json`
 * плюс десять форм, которых у него нет, на шести наборах правил — и разошлись
 * на нуле; у меры при этом был контроль чувствительности. Поэтому сведение
 * поведения не меняет, и это измеренное утверждение, а не обещание.
 *
 * Тело взято у замыкания побайтно. Проверка источника оставлена **в той же
 * форме**, в какой она участвовала в мере, а не переписана через
 * `normalizeFieldSourceKind`: переписанное было бы четвёртым телом, которого
 * никто не мерил (У-92).
 */
function resolveFieldOutputMode(field, rules) {
  if (field && typeof field.outputMode === "string") {
    const local = String(field.outputMode).trim().toLowerCase();
    if (local) return local;
  }
  const source = String(field && field.source ? field.source : "").trim();
  if (source === "projects" || source.indexOf("wikilinks:") === 0) return "wikilink";
  if (source && rules && rules[source] && typeof rules[source].output === "string") {
    return String(rules[source].output).trim().toLowerCase() || "tag";
  }
  return "tag";
}

function isProjectsSourceField(fieldOrSource) {
  return normalizeFieldSourceKind(fieldOrSource) === "projects";
}

function isWikilinkSourceField(fieldOrSource) {
  const kind = normalizeFieldSourceKind(fieldOrSource);
  return kind === "projects" || kind === "wikilinks";
}

function isSourceDrivenField(fieldOrSource) {
  const kind = normalizeFieldSourceKind(fieldOrSource);
  return kind === "projects" || kind === "wikilinks";
}

/**
 * Выполнено ли предусловие Field — **одно объявление на все три дороги**.
 *
 * Правило записано в PRD 10.13.4, Н21, и слово там сказано прямо: «Field с
 * предусловием не показывается ни в TagWheel, **ни в своих командах**, ни в
 * строке, пока у Field-предусловия нет значения». Панель его спрашивала —
 * внутри `isFieldEnabled` в `tagwheel_core.js`, — а команды поля не
 * спрашивали вовсе: на пустой строке `Project next` писал значение, хотя
 * панель этого Field в том же месте не показывает (обход строки 2026-09-12).
 *
 * `selected` — то, что уже стоит на строке: у панели это её сессия, у команд —
 * их состояние, собранное разбором строки. Больше предусловию ничего не нужно,
 * поэтому и объявление одно, а спрашивать его может кто угодно.
 *
 * Отвечает `true`, когда предусловия нет вовсе: Field без `dependsOn` работает
 * всегда.
 */
function isFieldPrerequisiteMet(field, selected) {
  if (!field || typeof field !== "object") return true;
  const parentKey = String(field.dependsOn || "").trim();
  if (!parentKey) return true;
  const bag = selected && typeof selected === "object" ? selected : {};
  const parentValue = String(bag[parentKey] || "").trim();
  if (!parentValue) return false;
  const only = Array.isArray(field.enabledForParentValues) ? field.enabledForParentValues : null;
  if (only && only.length && only.indexOf(parentValue) === -1) return false;
  const never = Array.isArray(field.disabledForParentValues) ? field.disabledForParentValues : null;
  if (never && never.length && never.indexOf(parentValue) !== -1) return false;
  return true;
}

/*
 * **Чтения служебного файла правил здесь больше нет** (PRD 10.13.52, П-8, шаг
 * третий, 2026-09-13). Сняты три объявления: перебор кандидатов пути
 * (`buildPathCandidates`), приведение пути к `.md` (`normalizeRulesPath`) и
 * само чтение с запасным путём (`readRulesMarkdownWithFallback`). Правила
 * приезжают к движкам из настроек ключом `Rules data`, и последний читатель
 * файла — панель TagWheel — перешёл на него тем же заходом.
 */

function parseOrderConfig(raw, normalizeKey) {
  let src = raw;
  /* Дом один — `normalizeOrderKey` в `shared_utils.js` (10.13.168). Здесь
     стояло безымянное тело того же правила: форма, к которой сторож копий
     был слеп, потому что знал имя функции и имя довода, а не присваивание. */
  const normalize = typeof normalizeKey === "function" ? normalizeKey : __sharedUtils.normalizeOrderKey;
  if (typeof src === "string") {
    const s = src.trim();
    if (!s) src = null;
    else {
      try { src = JSON.parse(s); }
      catch (_) { src = null; }
    }
  }
  const leftDefault = [];
  const rightDefault = [];
  const activeDefault = {};
  const enabledDefault = {};
  const out = {
    left: leftDefault.slice(),
    right: rightDefault.slice(),
    lead: {},
    active: { ...activeDefault },
    freeRoam: {},
    freeRoamBehavior: {
      minimalSeparator: true,
      minimalPrefix: true,
      offPrefix: false,
      fullPlacement: "smart",
    },
    enabled: { ...enabledDefault },
    labels: {},
    strictNames: {},
    propertiesByField: {},
    types: {},
  };
  if (!src || typeof src !== "object" || Array.isArray(src)) return out;
  const discover = new Set(Object.keys(activeDefault));
  const collect = (k) => {
    const key = normalize(k);
    if (!key) return;
    discover.add(key);
  };
  if (Array.isArray(src.left)) for (const k of src.left) collect(k);
  if (Array.isArray(src.right)) for (const k of src.right) collect(k);
  if (src.active && typeof src.active === "object" && !Array.isArray(src.active)) {
    for (const k of Object.keys(src.active)) collect(k);
  }
  if (src.enabled && typeof src.enabled === "object" && !Array.isArray(src.enabled)) {
    for (const k of Object.keys(src.enabled)) collect(k);
  }
  for (const k of Array.from(discover)) {
    if (!Object.prototype.hasOwnProperty.call(out.active, k)) out.active[k] = "yes";
    if (!Object.prototype.hasOwnProperty.call(out.freeRoam, k)) out.freeRoam[k] = "off";
    if (!Object.prototype.hasOwnProperty.call(out.enabled, k)) out.enabled[k] = true;
  }
  const normArr = (arr) => arr.map((x) => normalize(String(x || "").trim())).filter(Boolean);
  if (Array.isArray(src.left)) out.left = normArr(src.left);
  if (Array.isArray(src.right)) out.right = normArr(src.right);
  if (src.lead && typeof src.lead === "object" && !Array.isArray(src.lead)) {
    const leftLead = normalize(src.lead.left);
    const rightLead = normalize(src.lead.right);
    if (leftLead && out.left.includes(leftLead)) out.lead.left = leftLead;
    if (rightLead && out.right.includes(rightLead)) out.lead.right = rightLead;
  }
  if (src.active && typeof src.active === "object" && !Array.isArray(src.active)) {
    for (const rawKey of Object.keys(src.active)) {
      const key = normalize(rawKey);
      if (!(key in out.active)) continue;
      const raw = String(src.active[rawKey] || "").trim().toLowerCase();
      if (raw === "yes" || raw === "no" || raw === "hotkey_only") out.active[key] = raw;
    }
  }
  if (src.freeRoam && typeof src.freeRoam === "object" && !Array.isArray(src.freeRoam)) {
    for (const rawKey of Object.keys(src.freeRoam)) {
      const key = normalize(rawKey);
      if (!(key in out.freeRoam)) continue;
      const raw = String(src.freeRoam[rawKey] || "").trim().toLowerCase();
      out.freeRoam[key] = raw === "minimal" || raw === "full" ? raw : "off";
    }
  }
  if (src.freeRoamBehavior && typeof src.freeRoamBehavior === "object" && !Array.isArray(src.freeRoamBehavior)) {
    if (typeof src.freeRoamBehavior.minimalSeparator === "boolean") {
      out.freeRoamBehavior.minimalSeparator = src.freeRoamBehavior.minimalSeparator;
    }
    if (typeof src.freeRoamBehavior.minimalPrefix === "boolean") {
      out.freeRoamBehavior.minimalPrefix = src.freeRoamBehavior.minimalPrefix;
    }
    if (typeof src.freeRoamBehavior.offPrefix === "boolean") {
      out.freeRoamBehavior.offPrefix = src.freeRoamBehavior.offPrefix;
    }
    const placement = String(src.freeRoamBehavior.fullPlacement || "").trim().toLowerCase();
    if (placement === "smart" || placement === "left" || placement === "right") {
      out.freeRoamBehavior.fullPlacement = placement;
    }
  }
  if (src.enabled && typeof src.enabled === "object" && !Array.isArray(src.enabled)) {
    for (const rawKey of Object.keys(src.enabled)) {
      const key = normalize(rawKey);
      if (!(key in out.enabled)) continue;
      if (typeof src.enabled[rawKey] !== "boolean") continue;
      if (!(src.active && typeof src.active === "object" && !Array.isArray(src.active)
        && (Object.prototype.hasOwnProperty.call(src.active, rawKey) || Object.prototype.hasOwnProperty.call(src.active, key)))) {
        out.active[key] = src.enabled[rawKey] ? "yes" : "no";
      }
    }
  }
  if (src.labels && typeof src.labels === "object" && !Array.isArray(src.labels)) {
    for (const rawKey of Object.keys(src.labels)) {
      const key = normalize(rawKey);
      if (!key) continue;
      const v = String(src.labels[rawKey] || "").trim();
      if (!v) continue;
      out.labels[key] = v;
    }
  }
  if (src.strictNames && typeof src.strictNames === "object" && !Array.isArray(src.strictNames)) {
    for (const rawKey of Object.keys(src.strictNames)) {
      const key = normalize(rawKey);
      if (!key) continue;
      const v = String(src.strictNames[rawKey] || "").trim();
      if (!v) continue;
      out.strictNames[key] = v;
    }
  }
  if (src.types && typeof src.types === "object" && !Array.isArray(src.types)) {
    for (const rawKey of Object.keys(src.types)) {
      const key = normalize(rawKey);
      if (!key) continue;
      const v = String(src.types[rawKey] || "").trim().toLowerCase();
      if (v !== "tag" && v !== "wikilink" && v !== "element") continue;
      out.types[key] = v;
    }
  }
  if (src.propertiesByField && typeof src.propertiesByField === "object" && !Array.isArray(src.propertiesByField)) {
    for (const rawKey of Object.keys(src.propertiesByField)) {
      const key = normalize(rawKey);
      if (!key) continue;
      const v = String(src.propertiesByField[rawKey] || "").trim();
      if (!v) continue;
      out.propertiesByField[key] = v;
    }
  }
  for (const k of Object.keys(out.enabled)) out.enabled[k] = out.active[k] !== "no";
  for (const k of Object.keys(out.active)) {
    if (!Object.prototype.hasOwnProperty.call(out.labels, k)) out.labels[k] = k;
    if (!Object.prototype.hasOwnProperty.call(out.strictNames, k)) out.strictNames[k] = k;
    if (!Object.prototype.hasOwnProperty.call(out.freeRoam, k)) out.freeRoam[k] = "off";
  }
  return out;
}

function resolveFieldFreeRoamMode(orderCfg, fieldKey) {
  const key = String(fieldKey || "").trim();
  if (!key) return "off";
  const src = orderCfg && typeof orderCfg === "object" && !Array.isArray(orderCfg) && orderCfg.freeRoam && typeof orderCfg.freeRoam === "object"
    ? orderCfg.freeRoam
    : {};
  const raw = String(src[key] || "").trim().toLowerCase();
  if (raw === "minimal" || raw === "full") return raw;
  return "off";
}

function resolveFreeRoamBehavior(orderCfg) {
  const src = orderCfg && typeof orderCfg === "object" && !Array.isArray(orderCfg) && orderCfg.freeRoamBehavior && typeof orderCfg.freeRoamBehavior === "object"
    ? orderCfg.freeRoamBehavior
    : {};
  const placement = String(src.fullPlacement || "").trim().toLowerCase();
  const sepRaw = src.minimalSeparator;
  const sepStr = String(sepRaw == null ? "" : sepRaw).trim().toLowerCase();
  const minimalSeparator = !(sepRaw === false || sepStr === "false" || sepStr === "off" || sepStr === "no" || sepStr === "0");
  const prefixRaw = src.minimalPrefix;
  const prefixStr = String(prefixRaw == null ? "" : prefixRaw).trim().toLowerCase();
  const minimalPrefix = !(prefixRaw === false || prefixStr === "false" || prefixStr === "off" || prefixStr === "no" || prefixStr === "0");
  const offPrefixRaw = src.offPrefix;
  const offPrefixStr = String(offPrefixRaw == null ? "" : offPrefixRaw).trim().toLowerCase();
  const offPrefix = !!(offPrefixRaw === true || offPrefixStr === "true" || offPrefixStr === "on" || offPrefixStr === "yes" || offPrefixStr === "1");
  return {
    minimalSeparator,
    minimalPrefix,
    offPrefix,
    fullPlacement: placement === "left" || placement === "right" ? placement : "smart",
  };
}

function resolveFieldActiveMode(orderCfg, fieldKey) {
  const key = String(fieldKey || "").trim();
  if (!key) return "yes";
  const active = orderCfg && typeof orderCfg === "object" && !Array.isArray(orderCfg) && orderCfg.active && typeof orderCfg.active === "object"
    ? orderCfg.active
    : {};
  const raw = String(active[key] || "").trim().toLowerCase();
  if (raw === "no" || raw === "hotkey_only") return raw;
  return "yes";
}

function resolvePanelForField(orderCfg, fieldKey, options) {
  const opts = options && typeof options === "object" ? options : {};
  const fallback = String(opts.defaultPanel || "left").trim().toLowerCase() === "right" ? "right" : "left";
  /* Тот же дом (10.13.168). Этот запасной ход живой: звавшие из панели
     передают только `defaultPanel`, и до правки они получали копию
     правила, а остальные — дом. Тела совпадали до знака. */
  const normalize = typeof opts.normalizeKey === "function"
    ? opts.normalizeKey
    : __sharedUtils.normalizeOrderKey;
  const key = String(normalize(fieldKey) || "").trim();
  if (!key) return fallback;
  const enabled = orderCfg && typeof orderCfg === "object" && !Array.isArray(orderCfg) && orderCfg.enabled && typeof orderCfg.enabled === "object"
    ? orderCfg.enabled
    : {};
  const panelMap = orderCfg && typeof orderCfg === "object" && !Array.isArray(orderCfg) && orderCfg.panel && typeof orderCfg.panel === "object"
    ? orderCfg.panel
    : {};
  const activeMode = resolveFieldActiveMode(orderCfg, key);
  if (activeMode === "no" || activeMode === "hotkey_only") return fallback;
  if (enabled[key] === false) return fallback;
  if (Object.prototype.hasOwnProperty.call(panelMap, key)) {
    const panelRaw = String(panelMap[key] || "").trim().toLowerCase();
    if (panelRaw === "left" || panelRaw === "right") return panelRaw;
  }
  if (fallback === "left") {
    const right = Array.isArray(orderCfg && orderCfg.right) ? orderCfg.right : [];
    if (right.includes(key)) return "right";
    return "left";
  }
  const left = Array.isArray(orderCfg && orderCfg.left) ? orderCfg.left : [];
  if (left.includes(key)) return "left";
  return "right";
}

function buildPanelOrderKeys(orderCfg, panelName, options) {
  const opts = options && typeof options === "object" ? options : {};
  const panel = String(panelName || "left").trim().toLowerCase() === "right" ? "right" : "left";
  const src = panel === "right"
    ? (Array.isArray(orderCfg && orderCfg.right) ? orderCfg.right : [])
    : (Array.isArray(orderCfg && orderCfg.left) ? orderCfg.left : []);
  const enabled = orderCfg && typeof orderCfg === "object" && !Array.isArray(orderCfg) && orderCfg.enabled && typeof orderCfg.enabled === "object"
    ? orderCfg.enabled
    : {};
  const include = new Set(Array.isArray(opts.includeKeys) ? opts.includeKeys : []);
  const useInclude = include.size > 0;
  const collapseSubs = !!opts.collapseSubToParent;
  const out = [];
  const push = (k) => {
    if (!k) return;
    const activeMode = resolveFieldActiveMode(orderCfg, k);
    if (activeMode === "no" || activeMode === "hotkey_only") return;
    if (enabled[k] === false) return;
    if (useInclude && !include.has(k)) return;
    let key = k;
    if (collapseSubs) key = collapseSubOrderKey(key);
    if (!out.includes(key)) out.push(key);
  };

  for (const rawKey of src) {
    const k = String(rawKey || "").trim();
    if (!k) continue;
    push(k);
    const subCandidates = Object.keys(enabled).filter((cand) => {
      const ck = String(cand || "").trim();
      if (!ck || ck === k || !/_sub$/.test(ck)) return false;
      return collapseSubOrderKey(ck) === k;
    });
    for (const subKey of subCandidates) {
      if (enabled[subKey] === false) continue;
      push(subKey);
    }
  }
  return out;
}

function buildDateMarkers(timeMarker, startMarker, dueMarker) {
  const due = String(dueMarker || "").trim();
  const start = String(startMarker || "").trim();
  const time = String(timeMarker || "").trim();
  return {
    due: due ? [due] : [],
    start: start ? [start] : [],
    time: time ? [time] : [],
  };
}

function getDateFieldsFromRules(rules, options) {
  const opts = options && typeof options === "object" ? options : {};
  const strict = opts.strict === true;
  const rightFields = Array.isArray(rules && rules.rightMode && rules.rightMode.fields) ? rules.rightMode.fields : [];
  const behavior = rules && typeof rules.behavior === "object" && !Array.isArray(rules.behavior) ? rules.behavior : {};
  const dateRuntimeCfg = behavior && typeof behavior.dateRuntimeConfig === "object" && !Array.isArray(behavior.dateRuntimeConfig)
    ? behavior.dateRuntimeConfig
    : {};
  const canonical = dateRuntimeCfg && typeof dateRuntimeCfg.canonical === "object" && !Array.isArray(dateRuntimeCfg.canonical)
    ? dateRuntimeCfg.canonical
    : {};
  let due = null;
  let start = null;
  let timeNow = null;
  const dateOffset = [];
  const fieldByKey = {};
  const bindFieldKey = (key, field) => {
    const k = String(key || "").trim();
    if (!k || !field || fieldByKey[k]) return;
    fieldByKey[k] = field;
  };
  const resolveByAnyKey = (key) => {
    const k = String(key || "").trim();
    if (!k) return null;
    return fieldByKey[k] || null;
  };

  for (const field of rightFields) {
    if (!field || typeof field !== "object" || Array.isArray(field)) continue;
    const kind = String(field.kind || "").trim();
    bindFieldKey(String(field.id || "").trim(), field);
    bindFieldKey(String(field.orderKey || "").trim(), field);
    if (!timeNow && (kind === "nowTime" || kind === "estimatedCycle")) {
      timeNow = field;
      continue;
    }
    if (kind === "dateOffset") {
      dateOffset.push(field);
    }
  }

  due = resolveByAnyKey(canonical.due);
  start = resolveByAnyKey(canonical.start);
  if (!timeNow) timeNow = resolveByAnyKey(canonical.time);

  const dueKey = String(canonical.due || "").trim();
  const startKey = String(canonical.start || "").trim();
  const timeKey = String(canonical.time || "").trim();
  if (strict && dueKey && !due) throw new Error(`pkm_rules_runtime_helpers getDateFieldsFromRules: canonical.due unresolved (${dueKey})`);
  if (strict && startKey && !start) throw new Error(`pkm_rules_runtime_helpers getDateFieldsFromRules: canonical.start unresolved (${startKey})`);
  if (strict && timeKey && !timeNow) throw new Error(`pkm_rules_runtime_helpers getDateFieldsFromRules: canonical.time unresolved (${timeKey})`);

  if (dateOffset.length) {
    if (dateOffset.length === 1 && !due) due = dateOffset[0] || null;
    if (strict && dateOffset.length > 1 && (!due || !start)) {
      throw new Error("pkm_rules_runtime_helpers getDateFieldsFromRules: ambiguous dateOffset mapping; set dateRuntimeConfig.canonical.due/start")
    }
  }

  return { due, start, timeNow };
}

function getDefaultDateLikeMarkers() {
  return [];
}

function isDateLikeToken(token, options) {
  const opts = options && typeof options === "object" ? options : {};
  const markers = Array.isArray(opts.markers) && opts.markers.length
    ? opts.markers
    : getDefaultDateLikeMarkers();
  const src = String(token || "").trim();
  if (!src) return false;
  for (const marker of markers) {
    const mk = String(marker || "");
    if (mk && src.startsWith(mk) && src.length > mk.length) return true;
  }
  return false;
}

function hasDateLikeMarkerInText(text, options) {
  const opts = options && typeof options === "object" ? options : {};
  const markers = Array.isArray(opts.markers) && opts.markers.length
    ? opts.markers
    : getDefaultDateLikeMarkers();
  const src = String(text || "");
  if (!src) return false;
  for (const marker of markers) {
    const mk = String(marker || "");
    if (mk && src.includes(mk)) return true;
  }
  return false;
}

/**
 * Снять с блока все токены этой метки.
 *
 * **Три образца вместо одного, и берётся самый длинный.** Прежде тут стояли
 * три прохода подряд: образец формата, потом «метка плюс одно слово», потом
 * «метка без значения». Второй проход и терял вторую половину: значение
 * формата `YYYY-MM-DD hh:mm` занимает два слова, и всё, что не совпало с
 * нынешним форматом, обрезалось по первому пробелу. Хвост `21:32` оставался
 * в строке и дальше объявлялся текстом человека — ряд, который заказчик
 * прислал 2026-09-12 (PRD 10.13.71).
 *
 * Теперь образцы спрашиваются **разом**, и выигрывает тот, кто узнал больше:
 * формат поля, общий вид даты со временем, метка без значения, слово до
 * пробела. Порядок в списке ничего не решает — это и есть смысл правки
 * (`longestValueLengthAt`).
 *
 * Метка, стоящая не с начала токена (`abc📅2026-09-11`), не наша и не
 * трогается — как и раньше.
 */
function removeMarkerTokensFromSegment(segText, marker, valueRx) {
  const mk = String(marker || "");
  if (!mk) return String(segText || "");
  return __sharedUtils.removeMarkerValueTokens(
    segText,
    mk,
    __sharedUtils.elementValueSources(valueRx, mk)
  );
}

function escapeRegex(text) {
  /* Правило объявлено один раз — `escapeRe` в `shared_utils.js` (У-32).
     Своя копия стояла здесь и расходилась с ним на `0` и `false`:
     `String(s || "")` отдавала пустую строку, то есть пустую
     альтернативу регулярного выражения, а та совпадает со всем. */
  return __sharedUtils.escapeRe(text);
}

/**
 * Чем записан хвост эмодзи-элемента, выведенный из его формата.
 *
 * `YYYY-MM-DD hh:mm` даёт `\d{4}-\d{2}-\d{2}[ ]\d{2}:\d{2}`: буквы образца
 * становятся цифрами, пробел — пробелом, остальное — собой.
 *
 * **Это второе объявление того же правила**: первое живёт в `main.js`
 * (`elementTailPatternFromFormat`, правка C35) и нужно там отрисовке. Свести
 * их в один модуль нечем — `main.js` грузит этот файл не через `require`, а
 * мостом vault, — поэтому расхождение сторожит пин, сверяющий обе функции на
 * наборе форматов (У-32).
 */
function elementTailPatternFromFormat(format) {
  const src = String(format || "").trim();
  if (!src) return "";
  let out = "";
  let i = 0;
  while (i < src.length) {
    const ch = src[i];
    if (/[A-Za-z]/.test(ch)) {
      let n = 0;
      while (i < src.length && /[A-Za-z]/.test(src[i])) { i += 1; n += 1; }
      out += "\\d{" + n + "}";
      continue;
    }
    if (ch === " ") { out += "[ ]"; i += 1; continue; }
    out += escapeRegex(ch);
    i += 1;
  }
  return out;
}

/**
 * Разбор блока строки на токены — с оглядкой на эмодзи-элементы.
 *
 * Почему не `split(/\s+/)`. Элемент, у которого в формате есть пробел
 * (`📅YYYY-MM-DD hh:mm`), между пробелами не помещается: он разваливался на
 * `📅2026-09-02` и `20:43`. Первая половина узнавалась по метке и встала на
 * своё место в Order, вторая не узнавалась никем, уходила в корзину
 * неизвестных — а корзина печатается последней. Новые теги вставали по Order,
 * то есть **между половинами**:
 *
 *   было      `📅2026-09-02 20:43`
 *   стало     `📅2026-09-02 #work #AK 20:43`
 *
 * Заказчик прислал это символ в символ (свободное замечание, 2026-09-02).
 *
 * Длина хвоста выводится из формата поля — тем же правилом, которым её
 * выводит отрисовка (C35). Метки без формата и всё прочее режется по пробелу,
 * как раньше.
 *
 * Двенадцатое исключение к З3, разрешение заказчика 2026-09-02.
 */
function tokenizeSegmentBody(body, markers) {
  const src = String(body || "");
  const tails = markers && typeof markers.tailByMarker === "object" && markers.tailByMarker
    ? markers.tailByMarker
    : null;
  /* Длинные метки первыми: короткая не должна откусывать начало длинной. */
  const marked = tails
    ? Object.keys(tails).filter((mk) => mk && String(tails[mk] || "").trim()).sort((a, b) => b.length - a.length)
    : [];
  const out = [];
  let i = 0;
  while (i < src.length) {
    if (/\s/.test(src[i])) { i += 1; continue; }
    let taken = "";
    for (const mk of marked) {
      if (!src.startsWith(mk, i)) continue;
      const rx = new RegExp("^" + escapeRegex(mk) + "(?:" + tails[mk] + ")");
      const m = rx.exec(src.slice(i));
      if (m && m[0]) { taken = m[0]; break; }
    }
    if (!taken) {
      let j = i;
      while (j < src.length && !/\s/.test(src[j])) j += 1;
      taken = src.slice(i, j);
    }
    if (taken) out.push(taken);
    i += taken.length;
  }
  return out;
}

function getDateMarkersFromRules(rules, options) {
  const opts = options && typeof options === "object" ? options : {};
  const dateFields = getDateFieldsFromRules(rules);
  const rightFields = Array.isArray(rules && rules.rightMode && rules.rightMode.fields) ? rules.rightMode.fields : [];
  const behavior = rules && typeof rules.behavior === "object" && !Array.isArray(rules.behavior) ? rules.behavior : {};
  const dateRuntimeCfg = behavior && typeof behavior.dateRuntimeConfig === "object" && !Array.isArray(behavior.dateRuntimeConfig)
    ? behavior.dateRuntimeConfig
    : {};
  const byField = dateRuntimeCfg && typeof dateRuntimeCfg.byField === "object" && !Array.isArray(dateRuntimeCfg.byField)
    ? dateRuntimeCfg.byField
    : {};
  const canonical = dateRuntimeCfg && typeof dateRuntimeCfg.canonical === "object" && !Array.isArray(dateRuntimeCfg.canonical)
    ? dateRuntimeCfg.canonical
    : {};
  let due = String(opts.defaultDue || "").trim();
  let start = String(opts.defaultStart || "").trim();
  let time = String(opts.defaultTime || "").trim();
  if (dateFields.due && dateFields.due.marker) due = String(dateFields.due.marker);
  if (dateFields.start && dateFields.start.marker) start = String(dateFields.start.marker);
  if (dateFields.timeNow && dateFields.timeNow.marker) time = String(dateFields.timeNow.marker);
  const out = buildDateMarkers(time, start, due);
  const markerOrderPairs = [];
  const seenPairs = new Set();

  const runtimeKeysForField = (field) => {
    const outKeys = [];
    const push = (v) => {
      const k = String(v || "").trim();
      if (!k || outKeys.includes(k)) return;
      outKeys.push(k);
    };
    const orderKey = String(field && field.orderKey || "").trim();
    const fieldId = String(field && field.id || "").trim();
    push(orderKey);
    push(fieldId);
    for (const ck of Object.keys(canonical)) {
      const cv = String(canonical[ck] || "").trim();
      if (cv && (cv === orderKey || cv === fieldId)) {
        push(ck);
        push(cv);
      }
    }
    return outKeys;
  };

  const runtimeMarkerForField = (field) => {
    const keys = runtimeKeysForField(field);
    for (const key of keys) {
      const row = byField && typeof byField[key] === "object" && byField[key] ? byField[key] : null;
      if (!row) continue;
      const marker = String(row.emoji || row.marker || "").trim();
      if (marker) return marker;
    }
    return "";
  };

  for (const field of rightFields) {
    if (!field || typeof field !== "object" || Array.isArray(field)) continue;
    const kind = String(field.kind || "").trim();
    if (kind !== "dateOffset" && kind !== "nowTime" && kind !== "estimatedCycle" && kind !== "genericElement") continue;
    const marker = String(field.marker || "").trim() || runtimeMarkerForField(field);
    const orderKey = String(field.orderKey || "").trim();
    if (!marker || !orderKey) continue;
    const dedup = `${marker}::${orderKey}`;
    if (seenPairs.has(dedup)) continue;
    seenPairs.add(dedup);
    markerOrderPairs.push({ marker, orderKey });
  }
  out.all = Array.from(new Set(markerOrderPairs.map((x) => String(x.marker || "").trim()).filter(Boolean)));
  out.orderKeysByMarker = {};
  for (const pair of markerOrderPairs) {
    const marker = String(pair.marker || "").trim();
    const orderKey = String(pair.orderKey || "").trim();
    if (!marker || !orderKey) continue;
    if (!out.orderKeysByMarker[marker]) out.orderKeysByMarker[marker] = orderKey;
  }
  out.orderKeys = {
    time: String(dateFields.timeNow && dateFields.timeNow.orderKey || "").trim(),
    start: String(dateFields.start && dateFields.start.orderKey || "").trim(),
    due: String(dateFields.due && dateFields.due.orderKey || "").trim(),
  };
  /*
   * Чем записан хвост у каждой метки. Без этого элемент из двух слов не
   * собрать в один токен: длина хвоста живёт в формате поля, а не в метке
   * (Т-14, 2026-09-02).
   */
  const elements = behavior && typeof behavior.elements === "object" && !Array.isArray(behavior.elements)
    ? behavior.elements
    : {};
  const elementsByField = elements && typeof elements.byField === "object" && !Array.isArray(elements.byField)
    ? elements.byField
    : {};
  /*
   * **Формат спрашивается там же, откуда его берёт движок.** Карта строилась
   * только по `behavior.elements`, а движок дат читает формат из
   * `behavior.dateRuntimeConfig` — того, что приезжает ключом настроек. У
   * заказчика обе ветки совпадают, и расхождения не видно; там, где ветка
   * `elements` пуста, хвост не доезжал вовсе, и уборка снова резала значение
   * по первому пробелу (У-147: две согласные стороны не показывают, какую из
   * них читают). Поэтому сначала рантайм, потом `elements` — на те метки,
   * которых в рантайме нет.
   */
  out.tailByMarker = {};
  const addTails = (rows) => {
    for (const key of Object.keys(rows || {})) {
      const row = rows[key] && typeof rows[key] === "object" ? rows[key] : {};
      const marker = String(row.emoji || row.marker || "").trim();
      const tail = elementTailPatternFromFormat(row.format);
      if (!marker || !tail) continue;
      if (!out.tailByMarker[marker]) out.tailByMarker[marker] = tail;
    }
  };
  addTails(byField);
  addTails(elementsByField);
  return out;
}

const LEAD_PREFIX_RE = new RegExp(
  "^(" + __sharedUtils.LIST_PREFIX_SRC + "\\s+(?:" + __sharedUtils.CHECKBOX_ONE_CHAR_SRC + "\\s+)?)(.*)$"
);

function reorderSegmentTokensByOrder(segText, orderCfg, panelName, tokenToKey, options) {
  const opts = options && typeof options === "object" ? options : {};
  const source = String(segText || "").trim();
  /* Начало строки — знак человека, и форма у него общая (`LIST_PREFIX_SRC`).
     Здесь стоял свой образец из одного дефиса, и звёздочка, плюс или номер
     уезжали в зону значений как обычный токен (10.13.106). */
  const match = source.match(LEAD_PREFIX_RE);
  const lead = match ? match[1] : "";
  const body = match ? String(match[2] || "").trim() : source;
  /* Токены, а не куски между пробелами: эмодзи-элемент из двух слов иначе
     разваливается, и новые теги встают между его половинами (Т-14). */
  const parts = tokenizeSegmentBody(body, opts.markers);
  if (!parts.length) return lead ? String(lead).trim() : "";

  const orderKeys = buildPanelOrderKeys(orderCfg, panelName, {
    includeKeys: opts.includeKeys,
    collapseSubToParent: !!opts.collapseSubToParent,
  });
  if (!orderKeys.length) return source;

  const rank = {};
  for (let i = 0; i < orderKeys.length; i++) rank[orderKeys[i]] = i;
  const map = tokenToKey && typeof tokenToKey === "object" ? tokenToKey : {};
  const markers = opts.markers && typeof opts.markers === "object" ? opts.markers : null;

  const keyOf = (tokenInput) => {
    let token = String(tokenInput || "");
    if (opts.normalizeSlashToken && /^\/\S+/.test(token)) token = `#${token}`;

    let key = map[token] || "";
    if (opts.collapseSubToParent) {
      key = collapseSubOrderKey(key);
    }

    if (!key && typeof opts.resolveTokenKey === "function") {
      key = String(opts.resolveTokenKey(token, { orderCfg, panelName, tokenToKey: map, options: opts }) || "").trim();
      if (opts.collapseSubToParent) key = collapseSubOrderKey(key);
    }
    if (!key && markers) {
      const markerMap = markers.orderKeysByMarker && typeof markers.orderKeysByMarker === "object" ? markers.orderKeysByMarker : {};
      const markerList = Array.isArray(markers.all) && markers.all.length
        ? markers.all
        : Object.keys(markerMap);
      for (const mk of markerList) {
        const marker = String(mk || "").trim();
        if (!marker) continue;
        if (!token.startsWith(marker)) continue;
        const mapped = String(markerMap[marker] || "").trim();
        if (!mapped) continue;
        key = mapped;
        break;
      }
      const markerKeys = markers.orderKeys && typeof markers.orderKeys === "object" ? markers.orderKeys : {};
      if (!key) for (const mk of (markers.time || [])) if (mk && token.startsWith(mk)) { key = String(markerKeys.time || "").trim(); break; }
      if (!key) for (const mk of (markers.start || [])) if (mk && token.startsWith(mk)) { key = String(markerKeys.start || "").trim(); break; }
      if (!key) for (const mk of (markers.due || [])) if (mk && token.startsWith(mk)) { key = String(markerKeys.due || "").trim(); break; }
    }
    return { key, token };
  };

  const buckets = {};
  const unknown = [];
  for (const part of parts) {
    const resolved = keyOf(part);
    if (!resolved.key || rank[resolved.key] === undefined) {
      unknown.push(resolved.token);
      continue;
    }
    (buckets[resolved.key] ||= []).push(resolved.token);
  }

  const out = [];
  for (const key of orderKeys) {
    const arr = buckets[key] || [];
    for (const token of arr) out.push(token);
  }
  for (const token of unknown) out.push(token);

  const joined = out.join(" ").trim();
  if (!lead) return joined;
  const merged = joined ? `${lead}${joined}` : lead;
  return String(merged).replace(/\s+$/, "");
}

function getDefaultTagTokenKeyMapOptions() {
  return {
    projectTagWhenWikilink: true,
    activeFlagKeys: ["active", "enabled"],
  };
}

function getStatusTagReorderOptions() {
  return {
    includeKeys: null,
    collapseSubToParent: false,
    normalizeSlashToken: true,
    projectFromWikilink: false,
  };
}

function getStatusMixedReorderOptions(markers) {
  return {
    includeKeys: null,
    collapseSubToParent: false,
    normalizeSlashToken: true,
    projectFromWikilink: false,
    markers,
  };
}

function getUnifiedMixedReorderOptions(markers) {
  return getStatusMixedReorderOptions(markers);
}

function getTagWheelMixedReorderOptions(markers) {
  return getUnifiedMixedReorderOptions(markers);
}

function collectSourceCatalogValues(sourceConfig) {
  const out = [];
  const seen = new Set();
  const visited = new Set();

  const pushRaw = (raw) => {
    const text = String(raw || "").trim();
    if (!text) return;
    let token = text;
    let link = text;
    if (__sharedUtils.isWikilinkToken(text)) {
      const body = text.slice(2, -2).trim();
      if (!body) return;
      token = body;
      link = body;
    } else if (__sharedUtils.startsWithTagToken(text)) {
      token = text.replace(/^#/, "");
      link = token;
    }
    const dedupe = `${token}::${link}`;
    if (seen.has(dedupe)) return;
    seen.add(dedupe);
    out.push({ id: token, token, link });
  };

  const pushObj = (obj) => {
    if (!obj || typeof obj !== "object" || Array.isArray(obj)) return;
    const tokenRaw = String(obj.token || obj.id || obj.link || "").trim();
    if (!tokenRaw) return;
    let token = tokenRaw;
    let link = String(obj.link || tokenRaw).trim();
    if (__sharedUtils.isWikilinkToken(token)) token = token.slice(2, -2).trim();
    if (__sharedUtils.isWikilinkToken(link)) link = link.slice(2, -2).trim();
    token = token.replace(/^#/, "").trim();
    if (!token) return;
    if (!link) link = token;
    const dedupe = `${token}::${link}`;
    if (seen.has(dedupe)) return;
    seen.add(dedupe);
    out.push({ ...obj, id: String(obj.id || token), token, link });
  };

  const walk = (node) => {
    if (node == null) return;
    if (Array.isArray(node)) {
      for (const item of node) {
        if (typeof item === "string") pushRaw(item);
        else walk(item);
      }
      return;
    }
    if (typeof node === "string") {
      pushRaw(node);
      return;
    }
    if (typeof node !== "object") return;
    if (visited.has(node)) return;
    visited.add(node);
    pushObj(node);
    for (const key of Object.keys(node)) {
      walk(node[key]);
    }
  };

  walk(sourceConfig);
  return out;
}

/**
 * **Эта ссылка — значение поля или слово человека?** Одно объявление на все
 * дороги (его слово 2026-09-17, В-141).
 *
 * До этого дня вопрос задавался **форме**: `[[что угодно]]` считалось значением
 * поля везде, где спрашивали. Поэтому ссылку, которую `Inline to note` ставит
 * **вместо его текста**, плагин читал как значение левого Block: слота под текст
 * на строке не оставалось, и первая же команда поля дописывала его пустым —
 * `- [[333/имя]] ::  :: #/1 #processed`. Его слово: «она должна считаться
 * текстом… при любом из вариантов имя преобразованной заметки и текст не должны
 * подмешиваться в left block», и шире: «в left block строки должны быть только
 * те values, которые есть в fields left block — то же самое с right block».
 *
 * **Чем значение отличается от слова — измерено, а не выведено.** У его полей
 * типа link значения перечислены (`Project` — `test1`, `test2`, `test444`), и
 * ссылки Transform нет ни в одном списке. Сомнение разбора («а вдруг у поля со
 * свободным вводом списка нет вовсе») снято у самого продукта: `Free` в панели —
 * это `Prefix behavior`, то есть куда вставить значение, а не «любое значение
 * годится». Списка значений нет только у поля, которому нечего предлагать.
 *
 * Спрашивается та же карта «токен → поле», которой значения узнают все
 * остальные (`buildTagTokenKeyMap`): второй список ссылок разошёлся бы с ней
 * молча (У-32). Цель ссылки сверяется без подписи после черты — подпись человек
 * пишет для глаз, адресом заметки она не является.
 */
function makeWikilinkValueTest(rules) {
  const map = buildTagTokenKeyMap(rules) || {};
  const targets = new Set();
  for (const token of Object.keys(map)) {
    if (!__sharedUtils.isWikilinkToken(token)) continue;
    const target = __sharedUtils.wikilinkTargetOf(token);
    if (target) targets.add(target);
  }
  return function isFieldWikilinkValue(token) {
    const t = String(token || "").trim();
    if (!__sharedUtils.isWikilinkToken(t)) return false;
    const target = __sharedUtils.wikilinkTargetOf(t);
    return !!target && targets.has(target);
  };
}

function buildTagTokenKeyMap(rules, options) {
  const opts = options && typeof options === "object" ? options : {};
  const activeFlagKeys = Array.isArray(opts.activeFlagKeys) && opts.activeFlagKeys.length
    ? opts.activeFlagKeys
    : ["active", "enabled"];
  const projectTagWhenWikilink = opts.projectTagWhenWikilink !== false;

  const isActiveValue = (v) => {
    if (!v || typeof v !== "object" || Array.isArray(v)) return false;
    for (const flag of activeFlagKeys) {
      if (v[flag] === false) return false;
    }
    return true;
  };
  const activeValues = (field) => {
    const vals = Array.isArray(field && field.values) ? field.values : [];
    const source = String(field && field.source ? field.source : "").trim();
    const srcCfg = source && rules && typeof rules[source] === "object" && rules[source] ? rules[source] : null;
    const out = [];
    const seen = new Set();

    const pushVal = (v) => {
      if (!v || typeof v !== "object" || Array.isArray(v)) return;
      const token = String(v.token || "").trim();
      if (!token) return;
      const link = String(v.link || token).trim();
      const id = String(v.id || token).trim();
      const dedupe = `${id}::${token}::${link}`;
      if (seen.has(dedupe)) return;
      seen.add(dedupe);
      out.push({ ...v, id, token, link });
    };

    for (const v of vals) pushVal(v);
    if (srcCfg) {
      const sourceVals = collectSourceCatalogValues(srcCfg);
      for (const sv of sourceVals) pushVal(sv);
    }

    return out.filter(isActiveValue);
  };
  /* «Приставка плюс значение» — общий дом (10.13.152). Это тело было самым
     полным из четырёх, и от него дом отличается одним: пропуск насквозь
     любого готового тега снят. Он молча терял приставку, не равную решётке. */
  const composeToken = (prefix, rawToken) => __sharedUtils.composeToken(prefix, rawToken);

  const leftFields = rules && rules.leftMode && Array.isArray(rules.leftMode.fields) ? rules.leftMode.fields : [];
  /*
   * Правая корзина читается тоже, и это исключение № 7 из З3, разрешённое
   * заказчиком 2026-09-01 (замечание И-4).
   *
   * `leftMode` и `rightMode` документа правил — это **не** левая и правая
   * панели: `rules_markdown_builder` кладёт в них корзины `pkm.fields.tags` и
   * `pkm.fields.links`. Сторону же (Block) решает Order. Поэтому Field типа
   * link, стоящий у человека вторым слева, лежит в `rightMode`, в карту не
   * попадал, и `reorderSegmentTokensByOrder` считал его токен незнакомым — а
   * незнакомые дописываются **после** всех упорядоченных. Ссылка уезжала в
   * конец блока при любом Order.
   *
   * Правая корзина идёт второй и **не перетирает** уже занятый токен: карта
   * для левой корзины остаётся ровно такой, какой была, а новые ключи только
   * добавляются. Токен, поделённый тегом и ссылкой, по-прежнему принадлежит
   * тегу.
   */
  const rightFields = rules && rules.rightMode && Array.isArray(rules.rightMode.fields) ? rules.rightMode.fields : [];
  const mapFields = leftFields.concat(rightFields);
  const fieldById = (id) => mapFields.find((f) => f && f.id === id) || null;
  const out = {};

  const normalizeOrderKey = (field) => {
    if (!field) return "";
    const explicit = String(field.orderKey || "").trim();
    if (explicit) return explicit;
    if (typeof __pkmDomainRegistry.resolveOrderKeyFromFieldId !== "function") {
      throw new Error("pkm_domain_registry unavailable: resolveOrderKeyFromFieldId");
    }
    const mapped = String(__pkmDomainRegistry.resolveOrderKeyFromFieldId(field.id || "") || "").trim();
    if (mapped) return mapped;
    const source = String(field.source || "").trim();
    const id = String(field.id || "").trim();
    if (id) return id;
    if (source.endsWith("s") && source.length > 1) return source.slice(0, -1);
    return source;
  };

  /* Вопрос «каким выводом печатается это поле» объявлен один раз — выше, на
     уровне модуля. Здесь остаётся подстановка правил, которые лежат в
     замыкании. */
  const fieldOutputMode = (field) => resolveFieldOutputMode(field, rules);

  const addFieldTokens = (key, field, keepExisting) => {
    if (!field) return;
    const vals = activeValues(field);
    const outputMode = fieldOutputMode(field);
    const put = (token) => {
      if (!token) return;
      if (keepExisting === true && Object.prototype.hasOwnProperty.call(out, token)) return;
      out[token] = key;
    };
    for (const v of vals) {
      const rawToken = String(v && v.token ? v.token : "");
      if (!rawToken) continue;
      const link = String(v && v.link ? v.link : rawToken).trim();
      if (outputMode === "wikilink" && link) put(`[[${link}]]`);
      if (outputMode !== "wikilink" || projectTagWhenWikilink) {
        const pref = typeof field.prefix === "string" ? field.prefix : "#";
        put(composeToken(pref, rawToken));
      }
    }
  };

  for (const field of leftFields) {
    const key = normalizeOrderKey(field);
    if (!key) continue;
    addFieldTokens(key, field, false);
  }

  for (const field of rightFields) {
    const key = normalizeOrderKey(field);
    if (!key) continue;
    addFieldTokens(key, field, true);
  }

  const pairEntries = [];
  const pushPair = (parentField, subField) => {
    if (!parentField || !parentField.id || !subField || !subField.id) return;
    const dedupeKey = `${parentField.id}::${subField.id}`;
    if (pairEntries.some((p) => p.key === dedupeKey)) return;
    pairEntries.push({ key: dedupeKey, parentField, subField });
  };

  for (const subField of mapFields) {
    if (!subField || !subField.id) continue;
    const parentId = String(subField.dependsOn || "").trim();
    if (!parentId) continue;
    const parentField = fieldById(parentId);
    if (!parentField) continue;
    pushPair(parentField, subField);
  }

  for (const pair of pairEntries) {
    const parentField = pair.parentField;
    const subField = pair.subField;
    const parentKey = normalizeOrderKey(parentField);
    if (!parentKey) continue;
    const pref = typeof parentField.prefix === "string" ? parentField.prefix : "#";
    for (const pv of activeValues(parentField)) {
      const pTok = String(pv && pv.token ? pv.token : "");
      if (!pTok) continue;
      for (const sv of activeValues(subField)) {
        const sTok = String(sv && sv.token ? sv.token : "");
        if (!sTok) continue;
        out[composeToken(pref, `${pTok}/${sTok}`)] = parentKey;
      }
    }
  }
  return out;
}

function applyOrderToRules(rules, orderCfg, options) {
  const opts = options && typeof options === "object" ? options : {};
  const isObj = typeof opts.isObj === "function"
    ? opts.isObj
    : (x) => x && typeof x === "object" && !Array.isArray(x);

  if (!isObj(rules)) return;
  if (!isObj(rules.behavior)) rules.behavior = {};
  rules.behavior.order = {
    left: Array.isArray(orderCfg && orderCfg.left) ? orderCfg.left.slice() : [],
    right: Array.isArray(orderCfg && orderCfg.right) ? orderCfg.right.slice() : [],
    lead: isObj(orderCfg && orderCfg.lead) ? { ...orderCfg.lead } : {},
    active: isObj(orderCfg && orderCfg.active) ? { ...orderCfg.active } : {},
    enabled: isObj(orderCfg && orderCfg.enabled) ? { ...orderCfg.enabled } : {},
    labels: isObj(orderCfg && orderCfg.labels) ? { ...orderCfg.labels } : {},
    strictNames: isObj(orderCfg && orderCfg.strictNames) ? { ...orderCfg.strictNames } : {},
    types: isObj(orderCfg && orderCfg.types) ? { ...orderCfg.types } : {},
  };
  const leftFields = Array.isArray(rules && rules.leftMode && rules.leftMode.fields) ? rules.leftMode.fields : [];
  const rightFields = Array.isArray(rules && rules.rightMode && rules.rightMode.fields) ? rules.rightMode.fields : [];
  const allFields = leftFields.concat(rightFields);
  const byId = (arr, id) => arr.find((f) => f && String(f.id || "").trim() === String(id || "").trim());

  const dynamicKeys = [];
  const pushDyn = (k) => {
    /* Ключ Order приводится домом, а не на месте (10.13.168). */
    const key = __sharedUtils.normalizeOrderKey(k);
    if (!key || dynamicKeys.includes(key)) return;
    dynamicKeys.push(key);
  };
  for (const k of (orderCfg.left || [])) pushDyn(k);
  for (const k of (orderCfg.right || [])) pushDyn(k);
  for (const k of Object.keys(orderCfg.active || {})) pushDyn(k);
  for (const k of Object.keys(orderCfg.enabled || {})) pushDyn(k);
  for (const k of Object.keys(orderCfg.labels || {})) pushDyn(k);
  for (const k of Object.keys(orderCfg.strictNames || {})) pushDyn(k);
  for (const k of Object.keys(orderCfg.types || {})) pushDyn(k);

  const ids = {};
  const resolveIdByOrderKey = (key, visited) => {
    const k = String(key || "").trim();
    if (!k) return "";
    const seen = visited instanceof Set ? visited : new Set();
    if (seen.has(k)) return "";
    seen.add(k);
    const byOrder = allFields.find((f) => f && String(f.orderKey || "").trim() === k);
    if (byOrder && byOrder.id) return String(byOrder.id || "").trim();
    const byExactId = allFields.find((f) => f && String(f.id || "").trim() === k);
    if (byExactId && byExactId.id) return String(byExactId.id || "").trim();
    if (/_sub$/.test(k)) {
      const parentKey = collapseSubOrderKey(k);
      if (!parentKey || parentKey === k) return "";
      const parentId = ids[parentKey] || resolveIdByOrderKey(parentKey, seen);
      if (parentId) {
        const sub = leftFields.find((f) => f && String(f.dependsOn || "").trim() === String(parentId || "").trim());
        if (sub && sub.id) return String(sub.id || "").trim();
      }
    }
    return "";
  };

  for (const k of dynamicKeys) {
    const resolvedId = resolveIdByOrderKey(k);
    if (resolvedId) ids[k] = resolvedId;
  }

  const reorderModeFields = (mode, orderedIds) => {
    const fields = Array.isArray(mode && mode.fields) ? mode.fields : [];
    const byIdMap = new Map(fields.map((f) => [f && f.id, f]));
    const out = [];
    for (const id of orderedIds) if (byIdMap.has(id)) out.push(byIdMap.get(id));
    for (const f of fields) {
      if (!f || !f.id) continue;
      if (!orderedIds.includes(f.id)) out.push(f);
    }
    mode.fields = out;
  };

  const leftOrder = [];
  const rightOrder = [];
  for (const k of orderCfg.left || []) if (ids[k]) leftOrder.push(ids[k]);
  for (const k of orderCfg.right || []) if (ids[k]) rightOrder.push(ids[k]);
  reorderModeFields(rules.leftMode, leftOrder);
  reorderModeFields(rules.rightMode, rightOrder);

  const keyById = Object.fromEntries(Object.entries(ids).filter(([, v]) => v).map(([k, v]) => [v, k]));
  const leftOrderSet = new Set(Array.isArray(orderCfg && orderCfg.left) ? orderCfg.left : []);
  const rightOrderSet = new Set(Array.isArray(orderCfg && orderCfg.right) ? orderCfg.right : []);

  const runtimeExcludedIds = new Set();
  /*
   * `scopeFields` — где искать Field, которого ждёт зависимый (предусловие
   * Field, PRD 10.13.4).
   *
   * Определения тегов лежат в `leftMode.fields`, ссылок и элементов — в
   * `rightMode.fields`: их раскладывает по типу `ensureBehaviorModesFromOrder`
   * в `main.js`, и это НЕ Block, в который Field пишется. До 2026-08-27 каждый
   * список разбирался сам по себе, и связь через границу списков движок считал
   * сломанной: стирал `dependsOn` и ставил `enabled = false`.
   *
   * Решением заказчика от 2026-08-27 граница открыта **в одну сторону**: Field
   * правого списка — ссылка или элемент — может ждать Field любого списка,
   * Field левого списка по-прежнему только своего. Одно направление, а не оба,
   * потому что `dependsOn` у левого Field значит для движка ещё и «дочерний
   * тег»: его читают сборка `techOrder` ниже и слияние в `#parent/child`
   * (`buildCombinedSelectionSet`), и левый Field, ждущий ссылку, попал бы туда
   * не тем, чем он есть.
   *
   * Порядок полей внутри списка при этом остаётся своим: зависимый от чужого
   * списка Field считается корнем и стоит там же, где стоял.
   */
  const reconcileModeDependencies = (mode, scopeFields) => {
    const fields = Array.isArray(mode && mode.fields) ? mode.fields.slice() : [];
    const byId = new Map();
    for (const f of fields) {
      const fid = String(f && f.id || "").trim();
      if (!fid) continue;
      byId.set(fid, f);
    }
    const depById = new Map();
    for (const f of (Array.isArray(scopeFields) ? scopeFields : fields)) {
      const fid = String(f && f.id || "").trim();
      if (!fid) continue;
      depById.set(fid, f);
    }
    const scope = Array.from(depById.values());
    const runtimeEligible = new Set();
    for (const f of scope) {
      const fid = String(f && f.id || "").trim();
      if (!fid) continue;
      const dep = String(f && f.dependsOn || "").trim();
      if (!dep) runtimeEligible.add(fid);
    }
    let changed = true;
    while (changed) {
      changed = false;
      for (const f of scope) {
        const fid = String(f && f.id || "").trim();
        if (!fid || runtimeEligible.has(fid)) continue;
        const dep = String(f && f.dependsOn || "").trim();
        if (!dep || !depById.has(dep)) continue;
        if (!runtimeEligible.has(dep)) continue;
        runtimeEligible.add(fid);
        changed = true;
      }
    }

    const childrenByParent = new Map();
    const childIds = new Set();
    for (const f of fields) {
      const fid = String(f && f.id || "").trim();
      if (!fid) continue;
      const dep = String(f && f.dependsOn || "").trim();
      /* Родитель из другого списка порядок не задаёт: зависимый Field
         остаётся корнем и стоит там же, где стоял. */
      if (!dep || !byId.has(dep)) continue;
      childIds.add(fid);
      if (!childrenByParent.has(dep)) childrenByParent.set(dep, []);
      childrenByParent.get(dep).push(f);
    }

    const ordered = [];
    const used = new Set();
    const pushWithChildren = (parent) => {
      const pid = String(parent && parent.id || "").trim();
      if (!pid || used.has(pid)) return;
      ordered.push(parent);
      used.add(pid);
      const children = childrenByParent.get(pid) || [];
      for (const ch of children) {
        const cid = String(ch && ch.id || "").trim();
        if (!cid || used.has(cid)) continue;
        ordered.push(ch);
        used.add(cid);
      }
    };

    for (const f of fields) {
      const fid = String(f && f.id || "").trim();
      if (!fid || childIds.has(fid)) continue;
      pushWithChildren(f);
    }
    for (const f of fields) {
      const fid = String(f && f.id || "").trim();
      if (!fid || used.has(fid)) continue;
      ordered.push(f);
      used.add(fid);
    }

    for (const f of ordered) {
      const fid = String(f && f.id || "").trim();
      if (!fid) continue;
      const dep = String(f && f.dependsOn || "").trim();
      if (!dep) continue;
      const parentExists = depById.has(dep);
      if (!parentExists || !runtimeEligible.has(fid)) {
        f.enabled = false;
        runtimeExcludedIds.add(fid);
      }
      if (!parentExists) {
        f.dependsOn = "";
      }
    }
    mode.fields = ordered;
  };

  /* Левый список ищет родителя только у себя, правый — в обоих: см. разбор
     у `reconcileModeDependencies`. */
  reconcileModeDependencies(rules.leftMode, leftFields);
  reconcileModeDependencies(rules.rightMode, leftFields.concat(rightFields));

  /*
   * Короткое имя Field для TagWheel (`Name in TagWheel`, оно же `labels`).
   * Одно место на весь разбор: отсюда берётся и `placeholder` поля, и подпись
   * группы `rules.ui.leftGroups` (У-32).
   *
   * «Своего имени нет» здесь выглядит не как пустая подпись, а как подпись,
   * равная ключу: `parseOrderConfig` досыпает в `labels` сам ключ для каждого
   * встреченного Field. Это тот же признак, по которому панель показывает
   * строку `Name in TagWheel` пустой (`fields_model.setStrictName`). Без него
   * ветка вывода имени дочернего Field недостижима, и заказчик видел
   * `Category_sub` вместо `Cat_sub` при родителе `Cat` (D12).
   *
   * У дочернего Field своего короткого имени нет и заводить его заказчик не
   * захотел: дочка берёт имя родителя и добавляет `_sub` — было `sub`, стало
   * `Imp_sub`. Ключ дочки и есть `<ключ родителя>_sub`, поэтому родитель
   * находится отрезанием суффикса, а не отдельной картой связей.
   *
   * Своё короткое имя, если его когда-нибудь начнут задавать, сильнее
   * выведенного: сначала смотрим `labels[k]`, потом уже родителя.
   */
  const labelsMap = isObj(orderCfg.labels) ? orderCfg.labels : {};
  const ownShortName = (rawKey) => {
    const key = String(rawKey || "").trim();
    if (!key) return "";
    const v = String(labelsMap[key] ? labelsMap[key] : "").trim();
    return v && v !== key ? v : "";
  };
  const shortNameFor = (rawKey) => {
    const key = String(rawKey || "").trim();
    if (!key) return "";
    const own = ownShortName(key);
    if (own) return own;
    if (!/_sub$/.test(key)) return "";
    const parentShort = ownShortName(key.slice(0, -4));
    return parentShort ? parentShort + "_sub" : "";
  };

  for (const f of allFields) {
    const k = keyById[f.id];
    const fid = String(f && f.id || "").trim();
    if (!k) {
      if (f && f.enabled !== false) f.enabled = false;
      continue;
    }
    const activeMode = resolveFieldActiveMode(orderCfg, k);
    if (activeMode === "no" || activeMode === "hotkey_only") f.enabled = false;
    else if (orderCfg.enabled && orderCfg.enabled[k] === false) f.enabled = false;
    else if (f.enabled === false && !runtimeExcludedIds.has(fid)) f.enabled = true;
    if (rightOrderSet.has(k)) f.panel = "right";
    else if (leftOrderSet.has(k)) f.panel = "left";
    f.orderKey = k;
    const label = shortNameFor(k);
    if (label) f.placeholder = label;
  }

  const prevTechOrder = Array.isArray(rules && rules.inlineLayout && rules.inlineLayout.techOrder)
    ? rules.inlineLayout.techOrder
    : [];
  const outTechOrder = [];
  const left = Array.isArray(orderCfg && orderCfg.left) ? orderCfg.left : [];
  const pushUniq = (v) => { if (v && !outTechOrder.includes(v)) outTechOrder.push(v); };
  for (const k of left) {
    const id = String(ids[k] || "").trim();
    if (!id) continue;
    const field = byId(leftFields, id);
    if (!field) continue;
    if (isWikilinkSourceField(field)) {
      pushUniq(id);
      continue;
    }
    const dep = String(field.dependsOn || "").trim();
    if (dep) {
      pushUniq(dep);
      continue;
    }
    pushUniq(id);
  }
  if (!outTechOrder.length) {
    for (const slot of prevTechOrder) pushUniq(slot);
  }
  if (!outTechOrder.includes("otherTags")) {
    const hasWikilink = leftFields.some((f) => f && isWikilinkSourceField(f));
    if (hasWikilink) pushUniq("otherTags");
  }
  if (!isObj(rules.inlineLayout)) rules.inlineLayout = {};
  rules.inlineLayout.techOrder = outTechOrder;

  if (!isObj(rules.ui)) rules.ui = {};
  const allById = new Map();
  for (const f of leftFields) if (f && f.id) allById.set(f.id, f);
  for (const f of rightFields) if (f && f.id && !allById.has(f.id)) allById.set(f.id, f);
  const leftGroups = [];
  const seenLeftGroupFieldIds = new Set();
  const pushLeftGroup = (id, placeholder, fieldId, hideWhenDisabled) => {
    if (!fieldId || seenLeftGroupFieldIds.has(fieldId)) return;
    leftGroups.push({
      id,
      placeholder,
      fields: [fieldId],
      hideWhenDisabled: hideWhenDisabled === true,
    });
    seenLeftGroupFieldIds.add(fieldId);
  };
  const leftOrderArr = Array.isArray(orderCfg && orderCfg.left) ? orderCfg.left : [];
  const resolveLeftDisplay = (k, field) => {
    const fromOrder = shortNameFor(k);
    if (fromOrder) return fromOrder;
    const fromField = String(field && field.placeholder ? field.placeholder : "").trim();
    if (fromField) return fromField;
    return String(k || "").trim();
  };
  for (const k of leftOrderArr) {
    const fieldId = ids[k] || "";
    if (!fieldId) continue;
    const field = allById.get(fieldId) || null;
    pushLeftGroup(`${k}Group`, resolveLeftDisplay(k, field), fieldId, !!(field && field.dependsOn));
    for (const cand of leftFields) {
      if (!cand || !cand.id) continue;
      if (String(cand.dependsOn || "").trim() !== String(fieldId || "").trim()) continue;
      const childKey = String(keyById[cand.id] || "").trim();
      if (childKey && rightOrderSet.has(childKey)) continue;
      pushLeftGroup(
        `${cand.id}Group`,
        resolveLeftDisplay(childKey || cand.id, cand),
        cand.id,
        true
      );
    }
  }
  rules.ui.leftPanelOrderMode = "manual";
  rules.ui.leftGroups = leftGroups;
}

module.exports = {
  parseOrderConfig,
  resolveFieldActiveMode,
  resolveFieldFreeRoamMode,
  resolveFreeRoamBehavior,
  resolvePanelForField,
  buildPanelOrderKeys,
  buildDateMarkers,
  getDateFieldsFromRules,
  getDefaultDateLikeMarkers,
  isDateLikeToken,
  hasDateLikeMarkerInText,
  removeMarkerTokensFromSegment,
  getDateMarkersFromRules,
  reorderSegmentTokensByOrder,
  tokenizeSegmentBody,
  elementTailPatternFromFormat,
  getDefaultTagTokenKeyMapOptions,
  getStatusTagReorderOptions,
  getStatusMixedReorderOptions,
  getUnifiedMixedReorderOptions,
  getTagWheelMixedReorderOptions,
  buildTagTokenKeyMap,
  makeWikilinkValueTest,
  applyOrderToRules,
  /* Отдаётся наружу ради ожидания ответа: своё тело за запасным ходом
     снято, и вместо пина по тексту спрашивается сам ответ (10.13.161). */
  collapseSubOrderKey,
  normalizeFieldSourceKind,
  resolveFieldOutputMode,
  isProjectsSourceField,
  isWikilinkSourceField,
  isSourceDrivenField,
  isFieldPrerequisiteMet,
};
