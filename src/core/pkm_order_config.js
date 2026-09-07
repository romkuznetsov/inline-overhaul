/**
 * Порядок Fields: как он выводится, нормализуется и уезжает в макро-рантайм.
 *
 * Ключ Order — единственное, что связывает список порядка с определением Field
 * (У-49), поэтому и вывод типа, и вывод дочернего ключа, и сборка определений
 * живут здесь, в одном месте. `ensureBehaviorModesFromOrder` строит из порядка
 * ветку поведения PKM; её зовёт нормализация конфига.
 *
 * **Односторонняя связь.** Этот модуль о нормализации конфига не знает вовсе —
 * проверено обходом ссылок при переезде. Обратное неверно:
 * `config_normalize.js` зовёт отсюда две функции.
 *
 * **Откуда взялось.** Вынесено из `main.js` 2026-09-07, кусок третий разбора
 * A3 (PRD, раздел 11). Тела функций при переезде не правились.
 *
 * Модули — литеральным `require`, по одному на модуль (У-89).
 */
const __sharedUtils = require("./shared_utils.js");
const __pkmDomainRegistry = require("./pkm_domain_registry.js");

/* Те же однострочные обёртки, что были в `main.js`. */
function cloneJson(x) { return __sharedUtils.cloneJson(x); }
function isObj(x) { return __sharedUtils.isObj(x); }
function readCfgPath(root, path) { return __sharedUtils.readCfgPath(root, path); }

const PKM_ORDER_FIELDS = [];

const DATE_RUNTIME_KEY_NOW = "time_now";

const DATE_RUNTIME_KEY_ESTIMATED = "time_estimated";

function normalizeOrderFieldKey(key) {
  const k = String(key || "").trim().replace(/\s+/g, " ");
  if (!k) return "";
  return /^[a-z0-9_\- ]+$/i.test(k) ? k : "";
}

function inferOrderFieldType(key) {
  if (__pkmDomainRegistry && typeof __pkmDomainRegistry.inferOrderFieldType === "function") {
    return __pkmDomainRegistry.inferOrderFieldType(key);
  }
  const k = String(key || "").trim().toLowerCase();
  if (!k) return "tag";
  if (/wikilink|link/i.test(k)) return "wikilink";
  if (/date|time|deadline|due|start/i.test(k)) return "element";
  return "tag";
}

function inferElementDefaultsByKey(key) {
  const lower = String(key || "").trim().toLowerCase();
  const isTimeLike = /time/.test(lower);
  const isDateLike = /date|deadline|due|start/.test(lower);
  const marker = "";
  const format = isTimeLike ? "HH:mm" : (isDateLike ? "YYYY-MM-DD" : "");
  return { marker, format };
}

function inferSubFieldKey(parentKey) {
  if (__pkmDomainRegistry && typeof __pkmDomainRegistry.inferSubFieldKey === "function") {
    const inferred = String(__pkmDomainRegistry.inferSubFieldKey(parentKey) || "").trim();
    if (inferred) return inferred;
  }
  const p = String(parentKey || "").trim();
  return p ? `${p}_sub` : "";
}

function buildLeftFieldDefinition(key, kind) {
  if (kind === "wikilink") {
    return {
      id: key,
      prefix: "#",
      source: `wikilinks:${key}`,
      placeholder: key,
      values: [""],
    };
  }
  return {
    id: key,
    prefix: "#",
    placeholder: key,
    values: [""],
  };
}

function buildRightElementFieldDefinition(key) {
  const dflt = inferElementDefaultsByKey(key);
  return {
    id: key,
    kind: "genericElement",
    marker: dflt.marker,
    placeholder: key,
    values: [""],
  };
}

function ensureBehaviorModesFromOrder(cfg) {
  if (!isObj(cfg && cfg.pkm)) return;
  if (!isObj(cfg.pkm.fields)) cfg.pkm.fields = {};
  const fields = cfg.pkm.fields;
  const order = normalizePkmOrder(fields.order);
  fields.order = order;

  if (!isObj(fields.tags)) fields.tags = { fields: [] };
  if (!Array.isArray(fields.tags.fields)) fields.tags.fields = [];
  if (!isObj(fields.links)) fields.links = { fields: [] };
  if (!Array.isArray(fields.links.fields)) fields.links.fields = [];

  const leftFields = fields.tags.fields;
  const rightFields = fields.links.fields;
  const leftById = new Set(leftFields.map((f) => String(f && f.id || "").trim()).filter(Boolean));
  const rightById = new Set(rightFields.map((f) => String(f && f.id || "").trim()).filter(Boolean));

  const keys = [];
  const push = (k) => {
    const id = String(k || "").trim();
    if (!id || /_sub$/.test(id)) return;
    if (!keys.includes(id)) keys.push(id);
  };
  for (const k of order.left || []) push(k);
  for (const k of order.right || []) push(k);

  const builtInLeftIds = new Set();
  const builtInRightIds = new Set();
  const builtInOrderKeys = new Set();
   const allowedCustomTagIds = new Set();
   const allowedCustomWikilinkIds = new Set();
  const allowedCustomSubIds = new Set();
  /*
   * Дочерний Field ссылки. Отдельный набор, а не общий с тегом: тег и его
   * дочерний Field живут в leftMode, ссылка и её дочерний — в rightMode, и
   * один набор пустил бы каждого не на свою сторону.
   *
   * Без него дочерний Field ссылки не переживал ни одной записи: ключа
   * `<name>_sub` нет в `order.left` / `order.right` (`normalizePkmOrder`
   * складывает такие ключи отдельно), в наборы он не попадал, и фильтр ниже
   * выбрасывал его. `migrateConfig` идёт на каждом патче, поэтому дочернее
   * значение ссылки исчезало тут же после нажатия стрелки `Level`.
   */
  const allowedCustomLinkSubIds = new Set();
  const allowedCustomElementIds = new Set();
  for (const key of keys) {
    const kind0 = String(order.types && order.types[key] ? order.types[key] : inferOrderFieldType(key)).trim().toLowerCase();
    if (builtInOrderKeys.has(key)) continue;
    if (kind0 === "element") allowedCustomElementIds.add(key);
    else if (kind0 === "wikilink") {
      allowedCustomWikilinkIds.add(key);
      allowedCustomLinkSubIds.add(inferSubFieldKey(key));
    } else {
      allowedCustomTagIds.add(key);
      if (kind0 === "tag") allowedCustomSubIds.add(inferSubFieldKey(key));
    }
  }
  fields.tags.fields = leftFields.filter((f) => {
    const id = String(f && f.id || "").trim();
    if (!id) return false;
    if (builtInLeftIds.has(id)) return true;
    if (allowedCustomTagIds.has(id)) return true;
    if (allowedCustomSubIds.has(id)) return true;
    return false;
  });
  fields.links.fields = rightFields.filter((f) => {
    const id = String(f && f.id || "").trim();
    if (!id) return false;
    if (builtInRightIds.has(id)) return true;
    if (allowedCustomWikilinkIds.has(id)) return true;
    if (allowedCustomLinkSubIds.has(id)) return true;
    if (allowedCustomElementIds.has(id)) return true;
    return false;
  });

  const leftFieldsLive = fields.tags.fields;
  const rightFieldsLive = fields.links.fields;
  const leftByIdLive = new Set(leftFieldsLive.map((f) => String(f && f.id || "").trim()).filter(Boolean));
  const rightByIdLive = new Set(rightFieldsLive.map((f) => String(f && f.id || "").trim()).filter(Boolean));

  for (const key of keys) {
    const kind = String(order.types && order.types[key] ? order.types[key] : inferOrderFieldType(key)).trim().toLowerCase();
    if (builtInOrderKeys.has(key)) continue;
    if (kind === "element") {
      const elemCfg = isObj(fields.elements && fields.elements.byField && fields.elements.byField[key])
        ? fields.elements.byField[key]
        : {};
      const marker = String(elemCfg.emoji || inferElementDefaultsByKey(key).marker || "").trim();
      const placeholder = String(order.labels && order.labels[key] ? order.labels[key] : (key || "")).trim() || key;
      if (!rightByIdLive.has(key)) {
        const d = buildRightElementFieldDefinition(key);
        rightFieldsLive.push({ ...d, marker, placeholder });
        rightByIdLive.add(key);
      } else {
        const idx = rightFieldsLive.findIndex((f) => String(f && f.id || "").trim() === key);
        if (idx !== -1) {
          rightFieldsLive[idx] = {
            ...rightFieldsLive[idx],
            marker,
            placeholder,
          };
        }
      }
      continue;
    }
    if (kind === "wikilink") {
      if (!rightByIdLive.has(key)) {
        rightFieldsLive.push({
          id: key,
          prefix: "#",
          source: `wikilinks:${key}`,
          placeholder: String(order.labels && order.labels[key] ? order.labels[key] : key).trim() || key,
          values: [""],
        });
        rightByIdLive.add(key);
      }
      continue;
    }
    if (!leftByIdLive.has(key)) {
      leftFieldsLive.push(buildLeftFieldDefinition(key, kind));
      leftByIdLive.add(key);
    }
    if (kind === "tag") {
      const subKey = inferSubFieldKey(key);
      if (subKey && !leftByIdLive.has(subKey)) {
        const parentIdx = leftFieldsLive.findIndex((f) => String(f && f.id || "").trim() === key);
        const subDef = {
          id: subKey,
          prefix: "#",
          enabled: String(order.active && order.active[subKey] || "no").trim().toLowerCase() !== "no",
          dependsOn: key,
          disabledForParentValues: [],
          placeholder: "sub",
          values: [""],
        };
        if (parentIdx !== -1) leftFieldsLive.splice(parentIdx + 1, 0, subDef);
        else leftFieldsLive.push(subDef);
        leftByIdLive.add(subKey);
      }
      const subIdx = leftFieldsLive.findIndex((f) => String(f && f.id || "").trim() === subKey);
      if (subIdx !== -1) {
        const on = String(order.active && order.active[subKey] || "no").trim().toLowerCase() !== "no";
        leftFieldsLive[subIdx] = { ...leftFieldsLive[subIdx], enabled: on, dependsOn: key };
      }
      if (subKey && !Object.prototype.hasOwnProperty.call(order.active, subKey)) {
        order.active[subKey] = "no";
        order.enabled[subKey] = false;
      }
    }
  }

  if (!isObj(fields.elements)) fields.elements = { fields: [], byField: {} };
  if (!Array.isArray(fields.elements.fields)) fields.elements.fields = [];
  if (!isObj(fields.elements.byField)) fields.elements.byField = {};

  /* Легаси-ветка `pkm.fields.dates` сворачивается в `pkm.fields.elements`:
     единственный источник истины по элементам — `elements`. Маршрут
     `pkm.behavior.dates` заведён в миграции ровно ради этой ступени. */
  if (isObj(fields.dates)) {
    const legacyDates = fields.dates;
    const legacyFields = Array.isArray(legacyDates.fields) ? legacyDates.fields.map((x) => String(x || "").trim()).filter(Boolean) : [];
    for (const f of legacyFields) {
      if (!fields.elements.fields.includes(f)) fields.elements.fields.push(f);
    }
    const legacyByField = isObj(legacyDates.byField) ? legacyDates.byField : {};
    for (const fid of Object.keys(legacyByField)) {
      const id = String(fid || "").trim();
      if (!id) continue;
      const cur = isObj(fields.elements.byField[id]) ? fields.elements.byField[id] : {};
      const src = isObj(legacyByField[id]) ? legacyByField[id] : {};
      const merged = {
        ...src,
        ...cur,
        increment: {
          ...(isObj(src.increment) ? src.increment : {}),
          ...(isObj(cur.increment) ? cur.increment : {}),
        },
      };
      if (!String(merged.emoji || "").trim() && String(src.emoji || "").trim()) merged.emoji = String(src.emoji || "").trim();
      if (!String(merged.format || "").trim() && String(src.format || "").trim()) merged.format = String(src.format || "").trim();
      fields.elements.byField[id] = merged;
    }
    delete fields.dates;
  }

  const strictNames = isObj(order && order.strictNames) ? order.strictNames : {};

  for (const key of keys) {
    const kind = String(order.types && order.types[key] ? order.types[key] : inferOrderFieldType(key)).trim().toLowerCase();
    if (kind !== "element") continue;
    const strictKey = String(strictNames[key] || key).trim() || key;
    if (!fields.elements.fields.includes(key)) fields.elements.fields.push(key);
    const curElem = isObj(fields.elements.byField[key])
      ? fields.elements.byField[key]
      : (isObj(fields.elements.byField[strictKey]) ? fields.elements.byField[strictKey] : {});
    const cur = curElem;
    const incCur = isObj(cur.increment) ? cur.increment : {};
    const modeRaw = String(incCur.mode || "standard").trim().toLowerCase();
    const mode = modeRaw === "custom" || modeRaw === "command" ? modeRaw : "standard";
    const incrementBy = Math.max(1, Math.trunc(Number(incCur.incrementBy || 1)));
    const command = String(incCur.command || "now").trim() || "now";
    const customRaw = Array.isArray(incCur.customRaw)
      ? incCur.customRaw.map((x) => String(x || "").trim()).filter(Boolean)
      : [];
    const custom = Array.isArray(incCur.custom)
      ? incCur.custom.map((x) => Math.max(0, Math.trunc(Number(x || 0)))).filter((x) => Number.isFinite(x))
      : [];
    const nextBase = { ...cur };
    delete nextBase.hotkey;
    const normalizedEntry = {
      ...nextBase,
      emoji: Object.prototype.hasOwnProperty.call(cur, "emoji") ? String(cur.emoji || "").trim() : "",
      format: Object.prototype.hasOwnProperty.call(cur, "format") ? String(cur.format ?? "") : "",
      increment: {
        mode,
        incrementBy,
        command,
        customRaw,
        custom,
      },
    };
    fields.elements.byField[key] = normalizedEntry;
  }

  const activeElementKeys = new Set();
  for (const key of keys) {
    const kind = String(order.types && order.types[key] ? order.types[key] : inferOrderFieldType(key)).trim().toLowerCase();
    if (kind === "element") activeElementKeys.add(String(key || "").trim());
  }
  fields.elements.fields = (Array.isArray(fields.elements.fields) ? fields.elements.fields : [])
    .map((k) => String(k || "").trim())
    .filter((k) => k && activeElementKeys.has(k));
  for (const key of Object.keys(fields.elements.byField || {})) {
    const normKey = String(key || "").trim();
    if (!activeElementKeys.has(normKey)) delete fields.elements.byField[key];
  }
  fields.elements.fields = fields.elements.fields.filter((k) => activeElementKeys.has(String(k || "").trim()));

}

function makeDefaultPkmOrder() {
  return {
    left: [],
    right: [],
    lead: {},
    active: {},
    freeRoam: {},
    enabled: {},
    types: {},
    labels: {},
    strictNames: {},
    propertiesByField: {},
  };
}

/**
 * Что можно написать в имени Field.
 *
 * Та же строка стоит в панели — `STRICT_NAME_RE` в
 * `src/ui/settings/custom/fields_model.ts` — и то же говорит окно
 * переименования. Три места, одно правило: расхождение двух из них уже стоило
 * заказчику молча несработавшего переименования (1.3.1).
 */
const STRICT_FIELD_NAME_RE = /^[a-z0-9_\- ]+$/i;

function normalizePkmOrder(rawOrder) {
  const out = makeDefaultPkmOrder();
  if (!isObj(rawOrder)) return out;
  const discovered = new Set();
  const discoveredSub = new Set();
  const collectKey = (k) => {
    const id = normalizeOrderFieldKey(k);
    if (!id) return;
    if (/_sub$/.test(id)) {
      discoveredSub.add(id);
      return;
    }
    discovered.add(id);
  };
  if (Array.isArray(rawOrder.left)) for (const x of rawOrder.left) collectKey(x);
  if (Array.isArray(rawOrder.right)) for (const x of rawOrder.right) collectKey(x);
  if (isObj(rawOrder.labels)) for (const k of Object.keys(rawOrder.labels)) if (rawOrder.labels[k] !== null && rawOrder.labels[k] !== undefined && String(rawOrder.labels[k]).trim()) collectKey(k);
  if (isObj(rawOrder.strictNames)) for (const k of Object.keys(rawOrder.strictNames)) if (rawOrder.strictNames[k] !== null && rawOrder.strictNames[k] !== undefined && String(rawOrder.strictNames[k]).trim()) collectKey(k);
  if (isObj(rawOrder.active)) for (const k of Object.keys(rawOrder.active)) if (rawOrder.active[k] !== null && rawOrder.active[k] !== undefined && String(rawOrder.active[k]).trim()) collectKey(k);
  if (isObj(rawOrder.freeRoam)) for (const k of Object.keys(rawOrder.freeRoam)) if (rawOrder.freeRoam[k] !== null && rawOrder.freeRoam[k] !== undefined && String(rawOrder.freeRoam[k]).trim()) collectKey(k);
  if (isObj(rawOrder.enabled)) for (const k of Object.keys(rawOrder.enabled)) if (typeof rawOrder.enabled[k] === "boolean") collectKey(k);
  if (isObj(rawOrder.types)) for (const k of Object.keys(rawOrder.types)) if (rawOrder.types[k] !== null && rawOrder.types[k] !== undefined && String(rawOrder.types[k]).trim()) collectKey(k);
  if (isObj(rawOrder.propertiesByField)) for (const k of Object.keys(rawOrder.propertiesByField)) if (rawOrder.propertiesByField[k] !== null && rawOrder.propertiesByField[k] !== undefined && String(rawOrder.propertiesByField[k]).trim()) collectKey(k);
  const orderFields = Array.from(discovered);

  const normalizeList = (arr, fallback) => {
    if (!Array.isArray(arr)) return fallback.slice();
    const uniq = [];
    for (const x of arr) {
      const id = normalizeOrderFieldKey(x);
      if (!id || !discovered.has(id)) continue;
      if (uniq.includes(id)) continue;
      uniq.push(id);
    }
    return uniq.length ? uniq : fallback.filter((x) => discovered.has(x)).slice();
  };
  out.left = normalizeList(rawOrder.left, out.left);
  out.right = normalizeList(rawOrder.right, out.right);
  const ordered = new Set(out.left.concat(out.right));
  for (const k of orderFields) {
    if (ordered.has(k)) continue;
    out.right.push(k);
  }
  const orderKeys = orderFields.concat(Array.from(discoveredSub));
  if (isObj(rawOrder.lead)) {
    const leftLead = normalizeOrderFieldKey(rawOrder.lead.left);
    const rightLead = normalizeOrderFieldKey(rawOrder.lead.right);
    if (leftLead && out.left.includes(leftLead)) out.lead.left = leftLead;
    if (rightLead && out.right.includes(rightLead)) out.lead.right = rightLead;
  }
  if (isObj(rawOrder.active)) {
    for (const k of orderKeys) {
      const raw = String(rawOrder.active[k] || "").trim().toLowerCase();
      if (raw === "yes" || raw === "no" || raw === "hotkey_only") out.active[k] = raw;
    }
  }
  if (isObj(rawOrder.enabled)) {
    for (const k of orderKeys) {
      if (typeof rawOrder.enabled[k] !== "boolean") continue;
      if (!isObj(rawOrder.active) || !Object.prototype.hasOwnProperty.call(rawOrder.active, k)) {
        out.active[k] = rawOrder.enabled[k] ? "yes" : "no";
      }
    }
  }
  if (isObj(rawOrder.types)) {
    for (const k of orderFields) {
      const raw = String(rawOrder.types[k] || "").trim().toLowerCase();
      if (raw === "tag" || raw === "wikilink" || raw === "element") out.types[k] = raw;
    }
  }
  if (isObj(rawOrder.freeRoam)) {
    for (const k of orderKeys) {
      const raw = String(rawOrder.freeRoam[k] || "").trim().toLowerCase();
      if (raw === "minimal" || raw === "full") out.freeRoam[k] = raw;
      else if (raw === "off") out.freeRoam[k] = "off";
    }
  }
  for (const k of orderFields) {
    if (typeof out.types[k] !== "string" || !out.types[k]) out.types[k] = inferOrderFieldType(k);
  }

  if (isObj(rawOrder.labels)) {
    for (const k of orderFields) {
      if (typeof rawOrder.labels[k] === "string" && rawOrder.labels[k].trim()) {
        out.labels[k] = rawOrder.labels[k].trim();
      }
    }
  }
  if (isObj(rawOrder.strictNames)) {
    /*
     * Правило имени Field — одно на оба прохода.
     *
     * Раньше их было два: первый принимал имя с заглавными и пробелами,
     * второй требовал `^[a-z0-9_-]+$` и всё остальное **молча** возвращал к
     * исходному ключу. Панель разрешает то же, что первый проход, — и
     * переименование через карандаш не срабатывало никак: окно закрывалось,
     * имя оставалось прежним, сообщения не было (замечание заказчика 1.3.1).
     *
     * Верным признано мягкое правило: в идентификатор команды имя всё равно
     * идёт через `kebab()` (`src/features/command_ids.js`), а он и заглавные,
     * и пробелы переводит сам. То, что панель и конфиг говорят об имени одно
     * и то же, держит пин в `bootstrap_loader_tests.js`.
     */
    const used = new Set();
    for (const k of orderFields) {
      const v = String(rawOrder.strictNames[k] || "").trim();
      if (!STRICT_FIELD_NAME_RE.test(v)) continue;
      if (used.has(v)) continue;
      out.strictNames[k] = v;
      used.add(v);
    }
    const seen = new Set();
    for (const k of orderFields) {
      const v = String(out.strictNames[k] || "").trim() || k;
      if (!STRICT_FIELD_NAME_RE.test(v) || seen.has(v)) out.strictNames[k] = k;
      seen.add(out.strictNames[k]);
    }
  }
  if (isObj(rawOrder.propertiesByField)) {
    for (const k of orderFields) {
      const v = String(rawOrder.propertiesByField[k] || "").trim();
      if (!v) continue;
      out.propertiesByField[k] = v;
    }
  }
  for (const k of orderKeys) out.enabled[k] = out.active[k] !== "no";
  for (const k of orderKeys) {
    const raw = String(out.freeRoam && out.freeRoam[k] ? out.freeRoam[k] : "off").trim().toLowerCase();
    out.freeRoam[k] = raw === "minimal" || raw === "full" ? raw : "off";
  }
  return out;
}

function serializePkmOrderForMacro(cfg) {
  const order = normalizePkmOrder(readCfgPath(cfg, "pkm.fields.order"));
  const placement = isObj(readCfgPath(cfg, "pkm.placement")) ? readCfgPath(cfg, "pkm.placement") : {};
  /* Имена внутри `freeRoamBehavior` — часть контракта макросов рантайма
     (`docs/PKM_Runtime_Unified_Contract_v1.md`), поэтому меняются только
     источники значений, а не ключи. */
  order.freeRoamBehavior = {
    minimalSeparator: placement.keepPrefixInsertOnly !== false,
    minimalPrefix: placement.fieldPrefixInsertOnly !== false,
    offPrefix: placement.bulletInStrict === true,
    fullPlacement: ["smart", "left", "right"].includes(String(placement.freeInsertPosition || "").trim().toLowerCase())
      ? String(placement.freeInsertPosition || "").trim().toLowerCase()
      : "smart",
  };
  return JSON.stringify(order);
}

function serializeDateRuntimeConfigForMacro(cfg) {
  const elementsCfg = isObj(readCfgPath(cfg, "pkm.fields.elements"))
    ? readCfgPath(cfg, "pkm.fields.elements")
    : {};
  const order = normalizePkmOrder(readCfgPath(cfg, "pkm.fields.order"));
  const strict = isObj(order && order.strictNames) ? order.strictNames : {};
  const ORDER_DATE_DUE = `date_${"due"}`;
  const ORDER_DATE_START = `date_${"start"}`;
  const ORDER_TIME = ["ti", "me"].join("");
  const datesCanonical = {
    date_due: String(strict[ORDER_DATE_DUE] || ORDER_DATE_DUE).trim() || ORDER_DATE_DUE,
    date_start: String(strict[ORDER_DATE_START] || ORDER_DATE_START).trim() || ORDER_DATE_START,
    time: String(strict[ORDER_TIME] || ORDER_TIME).trim() || ORDER_TIME,
  };
  const dueName = String(datesCanonical.date_due || "").trim();
  const startName = String(datesCanonical.date_start || "").trim();
  const timeName = String(datesCanonical.time || "").trim();
  const byField = isObj(elementsCfg.byField) ? cloneJson(elementsCfg.byField) : {};
  const elementsByField = isObj(elementsCfg.byField) ? cloneJson(elementsCfg.byField) : {};
  const canonicalKeys = new Set([dueName, startName, timeName, DATE_RUNTIME_KEY_NOW, DATE_RUNTIME_KEY_ESTIMATED].filter(Boolean));
  const nonEmpty = (v) => String(v == null ? "" : v).trim();
  const mergeRuntimeField = (baseRow, incomingRow) => {
    const dst = isObj(baseRow) ? cloneJson(baseRow) : {};
    const src = isObj(incomingRow) ? cloneJson(incomingRow) : {};
    const out = { ...dst, ...src };
    if (!nonEmpty(src.emoji) && Object.prototype.hasOwnProperty.call(dst, "emoji")) out.emoji = String(dst.emoji || "");
    if (!nonEmpty(src.format) && Object.prototype.hasOwnProperty.call(dst, "format")) out.format = String(dst.format ?? "");
    if (isObj(dst.hotkey) || isObj(src.hotkey)) out.hotkey = { ...(isObj(dst.hotkey) ? dst.hotkey : {}), ...(isObj(src.hotkey) ? src.hotkey : {}) };
    if (isObj(dst.increment) || isObj(src.increment)) out.increment = { ...(isObj(dst.increment) ? dst.increment : {}), ...(isObj(src.increment) ? src.increment : {}) };
    return out;
  };
  for (const key of Object.keys(elementsByField)) {
    const normKey = String(key || "").trim();
    if (!normKey || canonicalKeys.has(normKey)) continue;
    byField[normKey] = mergeRuntimeField(byField[normKey], elementsByField[key]);
  }
  return JSON.stringify({
    fields: Array.isArray(elementsCfg.fields) ? elementsCfg.fields.slice() : [],
    byField,
    canonical: {
      date_due: String(dueName || ""),
      date_start: String(startName || ""),
      time: String(timeName || ""),
    },
  });
}

module.exports = {
  PKM_ORDER_FIELDS,
  DATE_RUNTIME_KEY_NOW,
  DATE_RUNTIME_KEY_ESTIMATED,
  normalizeOrderFieldKey,
  inferOrderFieldType,
  inferElementDefaultsByKey,
  inferSubFieldKey,
  buildLeftFieldDefinition,
  buildRightElementFieldDefinition,
  ensureBehaviorModesFromOrder,
  makeDefaultPkmOrder,
  STRICT_FIELD_NAME_RE,
  normalizePkmOrder,
  serializePkmOrderForMacro,
  serializeDateRuntimeConfigForMacro,
};
