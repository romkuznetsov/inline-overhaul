"use strict";

/*
 * Видимый текст сообщения по ключу каталога (PRD 10.13.50) — через общий
 * помощник `globalThis.__inlineSay`; своя копия правила дала Б-11. Литеральный
 * `require` без запасного пути (У-89, У-90, A33).
 */
const __sharedUtils = require("../core/shared_utils.js");
const __sayModule = require("../core/say.js");
const __say = __sayModule.say;
/* Ключ сообщения строит общий модуль: своей копии здесь нет (У-82). */
const __noticeKey = __sayModule.noticeKey;

/* Деление строки на зоны — у дома (У-153); правила собирает тот же сборщик, что у движков. */
const __linePipeline = require("../core/line_pipeline.js");
const __rulesShape = require("../core/pkm_rules_shape.js");
const __rulesHelpers = require("../core/pkm_rules_runtime_helpers.js");
/* Сборщик приставок — одна дорога с командой `plugin_commands.js` и предпросмотром `Source line` (C13). */
const __lineFinalize = require("../core/pkm_line_finalize_unified.js");
const __domainRegistry = require("../core/pkm_domain_registry.js");
const __pkmOrderConfig = require("../core/pkm_order_config.js");
const __editorVisualsConfig = require("../core/editor_visuals_config.js");

function getRulesShapeModule() { return __rulesShape; }

function isObj(v) {
  /* Правило — `isObj` в `shared_utils.js` (10.13.135). */
  return __sharedUtils.isObj(v);
}

const DEFAULT_INLINE2NOTE = {
  enabled: false,
  templatesFolder: "",
  outputFolder: "",
  defaultTemplate: "",
  smartRules: [],
  noteName: {
    mode: "auto",
    delimiters: "[]",
    wordCount: 6,
    preferHeaderTitle: true,
  },
  nameCollision: {
    mode: "new_note",
  },
  placement: {
    position: "end",
    headerMode: "datetime",
    /* Выбор заказчика по В-7 (2026-08-31): `## Captured` не спорит с `###` внутри заметки. */
    customHeader: "Captured",
    /* Уровень строки над текстом (10.13.9); `3` сохраняет прежний `###`. */
    headerLevel: "3",
    datetimeFormat: "YYYY-MM-DD HH:mm",
    /*
     * `At custom header` (З-4). Пусто — «заголовок не назван»: положение ведёт
     * себя как запасное, умолчание запасного — `end`.
     */
    targetHeader: "",
    fallback: "end",
  },
  yamlNoteFormat: "raw",
  /*
   * Ссылка на новую заметку в заметках, на которые ссылается строка (Н4, В-135).
   * Умолчание выключено: пишет в чужие заметки. `placement` нормализует то же
   * объявление, что у `Note content` (У-32); `headerMode` всегда `none`.
   */
  backlink: {
    enabled: false,
    /* `Link to Navigator` — PRD 10.13.272, В-224. */
    navigator: false,
    /* `Add empty line before wikilink` (2026-09-28); `true` — прежнее поведение. */
    emptyLine: true,
    placement: {
      position: "end",
      targetHeader: "",
      fallback: "end",
    },
  },
  sourceProcessing: {
    cleanupFieldIds: [],
    /* `Keep sub-fields` — PRD 10.13.272, В-224 и В-228. */
    keepSubFields: false,
    /*
     * Судьба текста исходной строки отдельно от ссылки (2026-09-01). Умолчание —
     * прежнее поведение при `replaceWithLink: true`.
     */
    text: "remove",
    keepWords: 3,
    token: "#processed",
    panel: "right",
    replaceWithLink: true,
    visual: {
      enabled: false,
      color: "",
      /* Процент, как у остальной прозрачности версии 2 (10.13.12 Н5). */
      opacity: 65,
    },
  },
  openTarget: false,
  sublines: "stay",
  floatingButton: false,
  /* Отступ кнопки от последнего символа строки, px (10.13.12 Н12). */
  floatingButtonGap: 12,
  preview: {
    sampleLine: "- [ ] #/1 #todo #context",
  },
};

function oneOfOrDefault(raw, allowed, dflt) {
  const s = String(raw || "").trim().toLowerCase();
  return allowed.includes(s) ? s : dflt;
}


function isInSpans(idx, spans) {
  const arr = Array.isArray(spans) ? spans : [];
  for (let i = 0; i < arr.length; i++) {
    const s = arr[i];
    if (!s) continue;
    if (idx >= s.start && idx < s.end) return true;
  }
  return false;
}

function uniq(arr) {
  const src = Array.isArray(arr) ? arr : [];
  const out = [];
  const seen = new Set();
  for (let i = 0; i < src.length; i++) {
    const s = String(src[i] || "").trim();
    if (!s) continue;
    if (seen.has(s)) continue;
    seen.add(s);
    out.push(s);
  }
  return out;
}

/**
 * Виды условия правила — один список на модуль. `fields` (10.13.7) хранит id
 * Fields, а не токены.
 */
const RULE_CONDITION_DIMS = ["tags", "emojiFields", "wikilinks", "fields"];

function hasAnyCondition(rule) {
  const c = rule && rule.conditions ? rule.conditions : {};
  return RULE_CONDITION_DIMS.some((d) => Array.isArray(c[d]) && c[d].length);
}

function intersects(a, b) {
  const setB = new Set(Array.isArray(b) ? b : []);
  const srcA = Array.isArray(a) ? a : [];
  for (let i = 0; i < srcA.length; i++) {
    if (setB.has(srcA[i])) return true;
  }
  return false;
}

function rulesCanOverlap(a, b) {
  const ca = a && a.conditions ? a.conditions : {};
  const cb = b && b.conditions ? b.conditions : {};
  const dims = RULE_CONDITION_DIMS;
  /* Спор — только при общем значении: правило по тегу и правило по ссылке,
     не делящие ни одного, выключали друг друга (BUGHUNT 2026-09-30, C8). */
  let shared = false;
  for (let i = 0; i < dims.length; i++) {
    const d = dims[i];
    const va = Array.isArray(ca[d]) ? ca[d] : [];
    const vb = Array.isArray(cb[d]) ? cb[d] : [];
    if (!va.length || !vb.length) continue;
    if (!intersects(va, vb)) return false;
    shared = true;
  }
  return shared;
}

function validateSmartRules(rules) {
  const src = Array.isArray(rules) ? rules : [];
  const out = src.map((r) => ({
    ...r,
    enabled: r && r.enabled !== false,
    validation: {
      isConflict: false,
      message: "",
      details: [],
    },
  }));

  /*
   * Вердикт разбора — только в `validation`, `enabled` остаётся за человеком
   * (2026-08-29, `smart_rules_tests.ts` раздел 10): функция идёт в
   * `migrateConfig` на каждом патче, и записанный в `enabled` вердикт молча
   * выключил бы правило навсегда. `selectSmartTemplate` и так пропускает
   * `validation.isConflict`.
   */
  const noConditions = out.map(() => false);
  for (let i = 0; i < out.length; i++) {
    if (!out[i].enabled) continue;
    if (!hasAnyCondition(out[i])) {
      noConditions[i] = true;
      out[i].validation = {
        isConflict: true,
        message: "Rule has no conditions. Add at least one tag/emoji/wikilink.",
        details: [],
      };
    }
  }

  const conflicts = out.map(() => []);
  for (let i = 0; i < out.length; i++) {
    for (let j = i + 1; j < out.length; j++) {
      if (!out[i].enabled || !out[j].enabled) continue;
      if (noConditions[i] || noConditions[j]) continue;
      if (!rulesCanOverlap(out[i], out[j])) continue;
      const ri = String(out[i].id || `rule-${i + 1}`);
      const rj = String(out[j].id || `rule-${j + 1}`);
      const detailsI = [];
      const detailsJ = [];
      const dims = RULE_CONDITION_DIMS;
      for (let di = 0; di < dims.length; di++) {
        const d = dims[di];
        const ai = Array.isArray(out[i].conditions && out[i].conditions[d]) ? out[i].conditions[d] : [];
        const aj = Array.isArray(out[j].conditions && out[j].conditions[d]) ? out[j].conditions[d] : [];
        const setJ = new Set(aj);
        for (let ti = 0; ti < ai.length; ti++) {
          const tok = String(ai[ti] || "").trim();
          if (!tok || !setJ.has(tok)) continue;
          detailsI.push({ dimension: d, token: tok, peerRuleId: rj });
          detailsJ.push({ dimension: d, token: tok, peerRuleId: ri });
        }
      }
      conflicts[i].push({ peerRuleId: rj, details: detailsI });
      conflicts[j].push({ peerRuleId: ri, details: detailsJ });
    }
  }
  for (let i = 0; i < out.length; i++) {
    if (!conflicts[i].length) continue;
    out[i].validation = {
      isConflict: true,
      message: `Conflicts with ${conflicts[i].map((entry) => entry.peerRuleId).join(", ")}. Overlapping conditions detected.`,
      details: conflicts[i].flatMap((entry) => entry.details),
    };
  }

  return out;
}

function normalizeSmartRules(rawRules, templatesFolder) {
  const src = Array.isArray(rawRules) ? rawRules : [];
  const out = [];
  for (let i = 0; i < src.length; i++) {
    const r = isObj(src[i]) ? src[i] : {};
    const id = String(r.id || `rule-${i + 1}`).trim() || `rule-${i + 1}`;
    const targetTemplate = keptTemplateChoice(r.targetTemplate, templatesFolder);
    const conditions = isObj(r.conditions) ? r.conditions : {};
    const tags = Array.isArray(conditions.tags) ? conditions.tags.map((x) => String(x || "").trim()).filter(Boolean) : [];
    const emojiFields = Array.isArray(conditions.emojiFields) ? conditions.emojiFields.map((x) => String(x || "").trim()).filter(Boolean) : [];
    const wikilinks = Array.isArray(conditions.wikilinks) ? conditions.wikilinks.map((x) => String(x || "").trim()).filter(Boolean) : [];
    /* Условие «любое значение Field» (10.13.7): id Fields, не токены. */
    const fields = Array.isArray(conditions.fields) ? conditions.fields.map((x) => String(x || "").trim()).filter(Boolean) : [];
    out.push({
      id,
      /*
       * Имя правила (PRD 10.8 С-3, З8): рантайм его не читает, но нормализация
       * идёт на каждом патче и иначе выбрасывала бы его.
       */
      name: String(r.name || "").trim(),
      enabled: r.enabled !== false,
      targetTemplate,
      conditions: { tags: uniq(tags), emojiFields: uniq(emojiFields), wikilinks: uniq(wikilinks), fields: uniq(fields) },
      /* Папка правила (10.13.8). Два ключа: папку с именем `near current note`
         иначе не отличить от выбора. */
      targetFolderMode: normalizeRuleFolderMode(r.targetFolderMode),
      targetFolder: normalizeFolderPath(r.targetFolder),
      /*
       * `Advanced settings` у правила (З-5). При `default` ветка всё равно
       * нормализуется: значения переживают переключение режима туда-обратно.
       */
      placementMode: oneOfOrDefault(r.placementMode, ["default", "custom"], "default"),
      placement: normalizePlacement(r.placement),
      validation: {
        isConflict: !!(r.validation && r.validation.isConflict),
        message: String(r.validation && r.validation.message ? r.validation.message : "").trim(),
        details: Array.isArray(r.validation && r.validation.details) ? r.validation.details.slice() : [],
      },
    });
  }
  return validateSmartRules(out);
}

/**
 * Прозрачность обработанной строки — процент `0…100` (10.13.12 Н5). Старая
 * доля `0…1` (≤ 1) умножается на сто; панель ниже двадцати не отдаёт.
 */
function normalizeProcessedOpacity(raw) {
  const n = Number(raw);
  if (!Number.isFinite(n)) return DEFAULT_INLINE2NOTE.sourceProcessing.visual.opacity;
  const pct = n > 0 && n <= 1 ? n * 100 : n;
  return Math.max(0, Math.min(100, Math.round(pct)));
}

/**
 * Отступ плавающей кнопки, px, в границах слайдера панели. Нечисло — умолчание,
 * а не ноль: ноль («вплотную») вернул бы исходный дефект.
 */
function normalizeFloatingButtonGap(raw) {
  const n = Number(raw);
  if (!Number.isFinite(n)) return DEFAULT_INLINE2NOTE.floatingButtonGap;
  return Math.max(0, Math.min(40, Math.round(n)));
}

/**
 * Ветка `placement`: куда ложится текст и что над ним. Одна функция для
 * `Note content` и ветки правила Smart Rules (З-5, У-32).
 */
function normalizePlacement(raw) {
  const placement = isObj(raw) ? raw : {};
  const out = {};
  out.position = oneOfOrDefault(placement.position, ["beginning", "end", "custom-header"], DEFAULT_INLINE2NOTE.placement.position);
  /*
   * Решётки в имени искомого заголовка сохраняются: ими задаётся его уровень.
   * Без них ищется заголовок любого уровня.
   */
  out.targetHeader = String(placement.targetHeader == null ? DEFAULT_INLINE2NOTE.placement.targetHeader : placement.targetHeader).trim();
  out.fallback = oneOfOrDefault(placement.fallback, ["beginning", "end"], DEFAULT_INLINE2NOTE.placement.fallback);
  out.headerMode = oneOfOrDefault(placement.headerMode, ["custom", "datetime", "none"], DEFAULT_INLINE2NOTE.placement.headerMode);
  /*
   * Решётки живут только в `headerLevel`; с текстбоксов снимаются на каждой
   * записи, иначе вышли бы двойные (10.13.9 Н3).
   */
  const customParts = splitLeadingHashes(placement.customHeader || DEFAULT_INLINE2NOTE.placement.customHeader);
  const formatParts = splitLeadingHashes(placement.datetimeFormat || DEFAULT_INLINE2NOTE.placement.datetimeFormat);
  out.customHeader = customParts.text || DEFAULT_INLINE2NOTE.placement.customHeader;
  out.datetimeFormat = formatParts.text || DEFAULT_INLINE2NOTE.placement.datetimeFormat;
  /*
   * Без `headerLevel` в старом файле уровень выводится из решёток человека, а при
   * `Date and time` — `###`, иначе заголовок молча стал бы мельче (10.13.9 Н5, приём У-17).
   */
  out.headerLevel = String(Object.prototype.hasOwnProperty.call(placement, "headerLevel")
    ? normalizeHeaderLevel(placement.headerLevel)
    : (customParts.level || (out.headerMode === "datetime" ? 3 : 0)));
  return out;
}

/**
 * Чей `placement` работает на этой строке (З-5). Подстановка «правило молчит —
 * берём общее» только здесь: её спрашивают три места (У-32).
 */
function resolvePlacementSource(i2n, smartRule) {
  const rule = isObj(smartRule) ? smartRule : null;
  if (!rule) return i2n;
  if (String(rule.placementMode || "default").trim().toLowerCase() !== "custom") return i2n;
  return { ...i2n, placement: normalizePlacement(rule.placement) };
}

function normalizeInline2Note(raw) {
  const src = isObj(raw) ? raw : {};
  const out = {
    enabled: src.enabled === true,
    templatesFolder: String(src.templatesFolder || "").trim(),
    outputFolder: String(src.outputFolder || "").trim(),
    defaultTemplate: keptTemplateChoice(src.defaultTemplate, src.templatesFolder),
    smartRules: normalizeSmartRules(src.smartRules, src.templatesFolder),
    noteName: {},
    nameCollision: {},
    placement: {},
    sourceProcessing: {},
    preview: {},
  };

  const noteName = isObj(src.noteName) ? src.noteName : {};
  out.noteName.mode = oneOfOrDefault(noteName.mode, ["auto", "manual"], DEFAULT_INLINE2NOTE.noteName.mode);
  out.noteName.delimiters = String(noteName.delimiters || DEFAULT_INLINE2NOTE.noteName.delimiters).trim() || "[]";
  out.noteName.wordCount = Math.max(1, Math.min(32, Math.trunc(Number(noteName.wordCount) || DEFAULT_INLINE2NOTE.noteName.wordCount)));
  out.noteName.preferHeaderTitle = noteName.preferHeaderTitle !== false;

  const nameCollision = isObj(src.nameCollision) ? src.nameCollision : {};
  out.nameCollision.mode = oneOfOrDefault(nameCollision.mode, ["new_note", "add_to_note", "overwrite"], DEFAULT_INLINE2NOTE.nameCollision.mode);

  out.placement = normalizePlacement(src.placement);
  /*
   * Куда ложится ссылка в чужой заметке — то же объявление, что для текста (У-32).
   * `headerMode` явно `none`: иначе нормализатор подставил бы `datetime`, и над
   * каждой ссылкой встала бы дата.
   */
  const backlink = isObj(src.backlink) ? src.backlink : {};
  const backlinkPlacement = normalizePlacement(isObj(backlink.placement) ? backlink.placement : {});
  out.backlink = {
    enabled: backlink.enabled === true,
    navigator: backlink.navigator === true,
    emptyLine: backlink.emptyLine !== false,
    /* Только три ключа с контролом; прочее было бы функцией без контрола (У-16, З8). */
    placement: {
      position: backlinkPlacement.position,
      targetHeader: backlinkPlacement.targetHeader,
      fallback: backlinkPlacement.fallback,
    },
  };
  out.yamlNoteFormat = oneOfOrDefault(src.yamlNoteFormat, ["raw", "clean"], DEFAULT_INLINE2NOTE.yamlNoteFormat);

  const sp = isObj(src.sourceProcessing) ? src.sourceProcessing : {};
  out.sourceProcessing.cleanupFieldIds = Array.isArray(sp.cleanupFieldIds) ? sp.cleanupFieldIds.map((x) => String(x || "").trim()).filter(Boolean) : [];
  out.sourceProcessing.keepSubFields = sp.keepSubFields === true;
  out.sourceProcessing.token = Object.prototype.hasOwnProperty.call(sp, "token")
    ? String(sp.token || "").trim()
    : DEFAULT_INLINE2NOTE.sourceProcessing.token;
  out.sourceProcessing.panel = oneOfOrDefault(sp.panel, ["left", "right"], DEFAULT_INLINE2NOTE.sourceProcessing.panel);
  out.sourceProcessing.replaceWithLink = sp.replaceWithLink !== false;
  /*
   * Без ключа `text` (старые настройки) судьба текста выводится из тумблера
   * ссылки, как было до разделения.
   */
  out.sourceProcessing.text = Object.prototype.hasOwnProperty.call(sp, "text")
    ? oneOfOrDefault(sp.text, ["leave", "remove", "words", "leave_named"], DEFAULT_INLINE2NOTE.sourceProcessing.text)
    : (out.sourceProcessing.replaceWithLink ? "remove" : "leave");
  out.sourceProcessing.keepWords = Number.isFinite(Number(sp.keepWords))
    ? Math.max(1, Math.min(20, Math.trunc(Number(sp.keepWords))))
    : DEFAULT_INLINE2NOTE.sourceProcessing.keepWords;
  const visual = isObj(sp.visual) ? sp.visual : {};
  out.sourceProcessing.visual = {
    enabled: visual.enabled === true,
    color: String(visual.color || "").trim(),
    opacity: normalizeProcessedOpacity(visual.opacity),
  };

  out.openTarget = src.openTarget === true;
  out.sublines = oneOfOrDefault(src.sublines, ["stay", "remove"], DEFAULT_INLINE2NOTE.sublines);

  /* `flyingButton.enabled` → `floatingButton` одним значением (PRD 8.1б, Р12);
     форму версии 1 разбирает миграция. */
  out.floatingButton = src.floatingButton === true;
  /* Отступ кнопки — см. `normalizeFloatingButtonGap`. */
  out.floatingButtonGap = normalizeFloatingButtonGap(src.floatingButtonGap);

  const preview = isObj(src.preview) ? src.preview : {};
  out.preview.sampleLine = String(preview.sampleLine || DEFAULT_INLINE2NOTE.preview.sampleLine);

  return out;
}

function normalizeTransformConfig(cfg) {
  const root = isObj(cfg) ? cfg : {};
  if (!isObj(root.transform)) root.transform = {};
  root.transform.inline2note = normalizeInline2Note(root.transform.inline2note);
  return root;
}

/**
 * Лежит ли шаблон в назначенной папке — один ответ для Smart Rules
 * (`collectTemplateOptions`), `Default template` (`src/ui/settings/templates.ts`)
 * и законности сделанного выбора (2026-09-16; замечание 1.6.6.2). Папка не
 * назначена — шаблонов нет. Путь приводится `normalizeFolderPath`. Путь,
 * равный папке, своим не считается.
 */
function templateBelongsToFolder(templatePath, templatesFolder) {
  const folder = normalizeFolderPath(templatesFolder);
  if (!folder) return false;
  const path = normalizeFolderPath(templatePath);
  if (!path) return false;
  return path.startsWith(folder + "/");
}

/**
 * Что остаётся от выбранного шаблона при смене папки шаблонов: всегда очищать
 * (В-127). Снимается в нормализации, то есть с первой набранной буквы папки —
 * цена принята заказчиком.
 */
function keptTemplateChoice(templatePath, templatesFolder) {
  const chosen = String(templatePath || "").trim();
  if (!chosen) return "";
  return templateBelongsToFolder(chosen, templatesFolder) ? chosen : "";
}

function collectTemplateOptions(app, folder) {
  if (!app || !app.vault || typeof app.vault.getMarkdownFiles !== "function") return [];
  const all = app.vault.getMarkdownFiles();
  return all
    .filter((f) => templateBelongsToFolder(f && f.path, folder))
    .map((f) => String(f.path || "").trim())
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b));
}

function resolveIoSeparators(cfg) {
  const io = isObj(cfg && cfg.pkm && cfg.pkm.lineFormat) ? cfg.pkm.lineFormat : null;
  const s1 = String(io && io.separator1 || "").trim();
  const s2 = String(io && io.separator2 || "").trim();
  if (!s1 || !s2) {
    throw new Error("missing pkm.lineFormat separators (separator1/separator2)");
  }
  return { separator1: s1, separator2: s2 };
}

function extractPrimaryPayloadText(line, separators) {
  const src = String(line || "");
  const s1 = escapeRegexLiteral(separators && separators.separator1 || "");
  const s2 = escapeRegexLiteral(separators && separators.separator2 || "");
  if (!s1) return "";
  if (s2) {
    const re = new RegExp(`${s1}\\s*([\\s\\S]*?)\\s*${s2}`);
    const m = src.match(re);
    if (m && m[1]) return String(m[1] || "").trim();
  }
  const reSingle = new RegExp(`${s1}\\s*([^\\n]+)$`);
  const mSingle = src.match(reSingle);
  if (!mSingle || !mSingle[1]) return "";
  return String(mSingle[1] || "").trim();
}

function escapeRegexLiteral(s) {
  /* Правило — `escapeRe` в `shared_utils.js` (У-32): своя копия на `0`/`false`
     давала пустую альтернативу, совпадающую со всем. */
  return __sharedUtils.escapeRe(s);
}

/** Values всех Element в режиме списка (`В-247`). */
function getElementListValuesFromConfig(cfg) {
  const byField = isObj(cfg && cfg.pkm && cfg.pkm.fields && cfg.pkm.fields.elements && cfg.pkm.fields.elements.byField)
    ? cfg.pkm.fields.elements.byField
    : {};
  const out = new Set();
  for (const key of Object.keys(byField)) {
    for (const v of __pkmOrderConfig.elementListValues(byField[key]) || []) out.add(v);
  }
  return out;
}

/**
 * Метки эмодзи-элементов и хвост у каждой: `[{ marker, tail }]`, `tail` —
 * образец из формата поля (`YYYY-MM-DD hh:mm` → `\d{4}-\d{2}-\d{2}[ ]\d{2}:\d{2}`);
 * без формата — до пробела. Длинные метки первыми, как в `tokenizeSegmentBody`.
 */
function getElementMarkerRulesFromConfig(cfg) {
  const out = [];
  const seen = new Set();
  const order = isObj(cfg && cfg.pkm && cfg.pkm.fields && cfg.pkm.fields.order) ? cfg.pkm.fields.order : {};
  const orderTypes = isObj(order.types) ? order.types : {};
  const elements = isObj(cfg && cfg.pkm && cfg.pkm.fields && cfg.pkm.fields.elements)
    ? cfg.pkm.fields.elements
    : {};
  const byField = isObj(elements.byField) ? elements.byField : {};
  const fields = getModeFields(cfg);
  for (let i = 0; i < fields.length; i++) {
    const f = isObj(fields[i]) ? fields[i] : {};
    const fid = String(f.id || "").trim();
    if (!fid) continue;
    const runtime = isObj(byField[fid]) ? byField[fid] : {};
    const explicitType = String(f.type || "").trim().toLowerCase();
    const byOrderType = String(orderTypes[fid] || "").trim().toLowerCase();
    const marker = String(f.marker || "").trim();
    const isElement = explicitType === "element" || byOrderType === "element" || !!marker;
    if (!isElement) continue;
    const finalMarker = resolveFieldMarker(f) || String(runtime.emoji || "").trim();
    if (!finalMarker || seen.has(finalMarker)) continue;
    seen.add(finalMarker);
    const format = String(f.format || runtime.format || "").trim();
    /*
     * Слот образца заполняет команда поля — спрашивается там же, где значение
     * пишется (`buildElementTailRegexSource`, У-32): у `Random characters`
     * формат — образец вида `111111`, а не описание значения (H1, правило 130,
     * У-208; S7, У-159).
     */
    const inc = isObj(runtime.increment) ? runtime.increment : {};
    const command = String(f.command || inc.command || "").trim();
    out.push({
      marker: finalMarker,
      tail: format ? String(__sharedUtils.buildElementTailRegexSource(format, command) || "") : "",
    });
  }
  out.sort((a, b) => b.marker.length - a.marker.length);
  return out;
}

/** Как записано значение этой метки: по формату поля, иначе — до пробела. */
function elementValuePattern(rule) {
  const tail = String(rule && rule.tail || "").trim();
  return tail ? `(?:${tail})` : "[^\\s]+";
}

/* Показательные цифры элемента. Дата настоящая: маску `YYYY-MM-DD` разборщик
   на строке не встретит (У-38). */
const ELEMENT_SAMPLE_DIGITS = { YYYY: "2026", yyyy: "2026", YY: "26", yy: "26", MM: "08", DD: "31", HH: "09", hh: "09", mm: "15", ss: "00" };

/**
 * Показательное значение элемента, законное для его формата: разбор тот же, что
 * у `elementTailPatternFromFormat` (сверку держит проверка, У-92).
 */
function elementSampleValueFromFormat(format) {
  const src = String(format || "").trim();
  if (!src) return "";
  let out = "";
  let i = 0;
  while (i < src.length) {
    if (!/[A-Za-z]/.test(src[i])) {
      out += src[i];
      i += 1;
      continue;
    }
    let run = "";
    while (i < src.length && /[A-Za-z]/.test(src[i])) {
      run += src[i];
      i += 1;
    }
    const known = ELEMENT_SAMPLE_DIGITS[run];
    out += known && known.length === run.length ? known : "0".repeat(run.length);
  }
  return out;
}

function resolveFieldMarker(field) {
  return String(field && (field.marker || field.prefix) || "").trim();
}

function formatDateTimeByPattern(date, pattern) {
  const d = date instanceof Date && !Number.isNaN(date.getTime()) ? date : new Date();
  const values = {
    YYYY: String(d.getFullYear()),
    YY: String(d.getFullYear()).slice(-2),
    MM: String(d.getMonth() + 1).padStart(2, "0"),
    DD: String(d.getDate()).padStart(2, "0"),
    HH: String(d.getHours()).padStart(2, "0"),
    mm: String(d.getMinutes()).padStart(2, "0"),
    ss: String(d.getSeconds()).padStart(2, "0"),
  };
  return String(pattern || "YYYY-MM-DD HH:mm").replace(/YYYY|YY|MM|DD|HH|mm|ss/g, (token) => values[token]);
}

/** Ведущие решётки строки: сколько их, и что остаётся без них. */
function splitLeadingHashes(raw) {
  const src = String(raw || "").trim();
  const m = /^(#{1,6})\s*(.*)$/.exec(src);
  if (!m) return { level: 0, text: src };
  return { level: String(m[1]).length, text: String(m[2] || "").trim() };
}

/**
 * `0` — обычная строка, `1`…`6` — заголовок (10.13.9). Отдаёт число; в конфиге
 * строка, как у прочих выпадающих списков схемы.
 */
function normalizeHeaderLevel(raw) {
  const n = Math.trunc(Number(raw));
  if (!Number.isFinite(n)) return Number(DEFAULT_INLINE2NOTE.placement.headerLevel);
  return Math.max(0, Math.min(6, n));
}

/**
 * Строка над вставленным текстом (10.13.9). Решётки ставит уровень, а не текст
 * (замечание 1.6.4.1).
 */
function formatHeaderByMode(i2n, now) {
  const placement = isObj(i2n && i2n.placement) ? i2n.placement : {};
  const mode = String(placement.headerMode || "").trim().toLowerCase();
  if (mode === "none") return "";
  const text = mode === "custom"
    ? splitLeadingHashes(placement.customHeader).text
    : formatDateTimeByPattern(now, splitLeadingHashes(
      String(placement.datetimeFormat || "YYYY-MM-DD HH:mm")).text || "YYYY-MM-DD HH:mm");
  if (!text) return "";
  const level = normalizeHeaderLevel(placement.headerLevel);
  return level > 0 ? `${"#".repeat(level)} ${text}` : text;
}

function normalizeRuleWikilink(raw) {
  const src = String(raw || "").trim();
  /* Не ссылка — как есть: правило пишут и просто именем заметки. */
  return __sharedUtils.wikilinkTargetOf(src) || src;
}

/**
 * Какие Fields стоят в строке и в какую группу условий попадает каждый.
 * Значения читаются из конфига в момент срабатывания (10.13.7 Н3); тип
 * выводится здесь один раз (У-32).
 */
function fieldsOnLine(cfg, present) {
  const seen = new Set();
  const groupOf = new Map();
  const fields = getModeFields(cfg);
  for (let i = 0; i < fields.length; i++) {
    const field = fields[i];
    const id = String(field && field.id || "").trim();
    if (!id) continue;
    const marker = String(field && field.marker || "").trim();
    const source = String(field && field.source || "").trim();
    const isLink = source === "projects" || source.indexOf("wikilinks:") === 0;
    groupOf.set(id, marker ? "emojiFields" : (isLink ? "wikilinks" : "tags"));
    if (marker && present.emojiMarkers.has(marker)) { seen.add(id); continue; }
    const candidates = fieldTokenCandidates(field);
    for (let vi = 0; vi < candidates.length; vi++) {
      const raw = String(candidates[vi].rawToken || "").trim();
      const full = String(candidates[vi].fullToken || "").trim();
      const hit = isLink
        ? present.wikilinks.has(normalizeRuleWikilink(raw))
        : present.tags.has(full);
      if (hit) { seen.add(id); break; }
    }
  }
  return { seen, groupOf };
}

/**
 * Правило, поймавшее строку, или `null` (результат — правило, ради папки
 * 10.13.8). Условие «любое значение Field» — ИЛИ внутри группы своего типа
 * (B14; хранится в `conditions.fields`, З1). Field, которого нет в конфиге,
 * правило не блокирует.
 */
function selectSmartRule(parsed, smartRules, cfg) {
  const p = isObj(parsed) ? parsed : {};
  /* Value — вхождение вне текста человека, как для YAML: тег посреди текста —
     слово (`В-235`; BUGHUNT 2026-09-30, C9). */
  const outsideText = (list, key) => (Array.isArray(list) ? list : [])
    .filter((o) => o && o.panel !== "payload").map((o) => o[key]);
  const tagsOnLine = Array.isArray(p.tagOccurrences) ? outsideText(p.tagOccurrences, "token") : p.tags;
  const linksOnLine = Array.isArray(p.wikilinkOccurrences) ? outsideText(p.wikilinkOccurrences, "target") : p.wikilinks;
  const present = {
    tags: new Set(Array.isArray(tagsOnLine) ? tagsOnLine.map((x) => String(x || "").trim()).filter(Boolean) : []),
    wikilinks: new Set(Array.isArray(linksOnLine) ? linksOnLine.map(normalizeRuleWikilink).filter(Boolean) : []),
    emojiMarkers: new Set((Array.isArray(p.emojis) ? p.emojis : []).map((x) => String(x && x.marker || "").trim()).filter(Boolean)),
  };
  addNavigatorsOfChildren(cfg, present);
  const rules = Array.isArray(smartRules) ? smartRules : [];
  let onLine = null;
  for (let i = 0; i < rules.length; i++) {
    const rule = rules[i];
    if (!rule || rule.enabled === false || rule.validation && rule.validation.isConflict) continue;
    const conditions = isObj(rule.conditions) ? rule.conditions : {};
    const wantedFields = Array.isArray(conditions.fields) ? conditions.fields : [];
    if (wantedFields.length && onLine === null) onLine = fieldsOnLine(cfg, present);
    const seen = onLine ? onLine.seen : new Set();
    const groupOf = onLine ? onLine.groupOf : new Map();
    const fieldsIn = (group) => wantedFields.filter(
      (id) => groupOf.get(String(id || "").trim()) === group);
    const conditionGroups = [
      [Array.isArray(conditions.tags) ? conditions.tags : [], present.tags, (x) => String(x || "").trim(), fieldsIn("tags")],
      [Array.isArray(conditions.emojiFields) ? conditions.emojiFields : [], present.emojiMarkers, (x) => String(x || "").trim(), fieldsIn("emojiFields")],
      [Array.isArray(conditions.wikilinks) ? conditions.wikilinks : [], present.wikilinks, normalizeRuleWikilink, fieldsIn("wikilinks")],
    ];
    if (!conditionGroups.some((group) => group[0].length || group[3].length)) continue;
    let matches = true;
    for (let gi = 0; gi < conditionGroups.length; gi++) {
      const [wanted, actual, normalize, wantedGroupFields] = conditionGroups[gi];
      if (!wanted.length && !wantedGroupFields.length) continue;
      const byValue = wanted.some((value) => actual.has(normalize(value)));
      const byField = wantedGroupFields.some((id) => seen.has(String(id || "").trim()));
      if (!byValue && !byField) {
        matches = false;
        break;
      }
    }
    if (matches) return rule;
  }
  return null;
}

/**
 * Ребёнок на строке приносит своих навигаторов (`В-222`): навигатор на строку не
 * пишут, и условие по нему иначе не ловило бы ничего.
 */
function addNavigatorsOfChildren(cfg, present) {
  const fields = getModeFields(cfg);
  for (const child of fields) {
    if (child.parentIsNavigator !== true || !child.dependsOn) continue;
    const parent = fields.find((f) => String(f.id) === String(child.dependsOn));
    if (!parent) continue;
    const isLink = (f) => String(f.source || "").indexOf("wikilinks:") === 0;
    const parentPrefix = String(parent.prefix || "#");
    for (const v of Array.isArray(child.values) ? child.values : []) {
      const tok = String(v && v.token || "").trim();
      if (!tok) continue;
      const onLine = isLink(child)
        ? present.wikilinks.has(normalizeRuleWikilink(tok))
        : present.tags.has(tok.startsWith("#") ? tok : `${String(child.prefix || "#")}${tok}`);
      if (!onLine) continue;
      for (const raw of Array.isArray(v.allowedParentValues) ? v.allowedParentValues : []) {
        const ptok = String(raw || "").trim();
        if (!ptok) continue;
        if (isLink(parent)) present.wikilinks.add(normalizeRuleWikilink(ptok));
        else present.tags.add(ptok.startsWith("#") ? ptok : `${parentPrefix}${ptok}`);
      }
    }
  }
}

function selectSmartTemplate(parsed, smartRules, defaultTemplate, cfg) {
  const rule = selectSmartRule(parsed, smartRules, cfg);
  const target = rule ? String(rule.targetTemplate || "").trim() : "";
  return target || String(defaultTemplate || "").trim();
}

/** `default` | `near` | `folder`; всё незнакомое — `default` (10.13.8 Н2). */
function normalizeRuleFolderMode(raw) {
  const v = String(raw || "").trim().toLowerCase();
  return v === "near" || v === "folder" ? v : "default";
}

/**
 * Путь папки так, как его понимает vault — правило спрошено у платформы (У-44,
 * Р3). `normalizePath` в `app.js` 1.13.7 — `Dl(Bl(e)).normalize("NFC")`:
 *
 *     Bl(e) = e.replace(/([\\/])+/g, "/").replace(/(^\/+|\/+$)/g, "")   // пусто → "/"
 *     Dl(e) = e.replace(/ | /g, " ")
 *
 * Отличие намеренное: пустой путь остаётся пустым («корень vault»), а не `"/"`.
 */
function normalizeFolderPath(raw) {
  return String(raw || "")
    .replace(/\u00A0|\u202F/g, " ")
    .trim()
    .replace(/[\\/]+/g, "/")
    .replace(/^\/+|\/+$/g, "")
    .normalize("NFC");
}

function parseInlineLine(rawLine, cfg) {
  const line = String(rawLine || "");
  const separators = resolveIoSeparators(cfg);
  const tags = [];
  const wikilinks = [];
  const tagOccurrences = [];
  const wikilinkOccurrences = [];
  const emojiOccurrences = [];
  const wikilinkSpans = [];
  const tagSpans = [];
  const emojis = [];
  const markerRules = getElementMarkerRulesFromConfig(cfg);
  const firstSeparator = line.indexOf(separators.separator1);
  const secondSeparator = firstSeparator >= 0
    ? line.indexOf(separators.separator2, firstSeparator + separators.separator1.length)
    : -1;
  /*
   * Единственный разделитель на строке — второй, и знает это дом (У-153,
   * `splitSegments`); позиционная копия теряла значения полей (G2, 2026-09-16).
   * Правила — сборщиком `pkm_rules_shape`.
   */
  const singleSeparator = firstSeparator >= 0 && secondSeparator < 0;
  let singleIsSecond = false;
  let homeText = null;
  let stayText = true;
  /* Строка без разделителей тоже спрашивает дом (`В-235`, T5): значения подряд в
     начале — Block, дальше текст. Текст отделяется только у строки со знаком
     начала; без него — прежний разбор. */
  {
    try {
      const rules = getRulesShapeModule().buildRulesForEngines(cfg);
      const seg = __linePipeline.splitSegments(line, rules);
      stayText = __sharedUtils.typedTagsStayText(rules);
      homeText = String(seg && seg.text != null ? seg.text : "");
      singleIsSecond = singleSeparator && !!String(seg && seg.dates || "").trim();
    } catch (_) {
      /* Правила могут не собраться на полуготовом конфиге — тогда позиционный
         разбор. Это проба, ответ «нет» — ответ. */
      homeText = null;
    }
    /* Выключенный `Keep typed tags in text` — прежний разбор: значения на такой
       строке — значения где угодно. */
    if (firstSeparator < 0 && (!stayText || !String(homeText || "").trim())) homeText = null;
  }
  /* Где на строке без разделителей стоит текст: тег и ссылка внутри — слово
     человека. Значения элементов посреди текста разбор не отделяет. */
  const plainText = (() => {
    if (firstSeparator >= 0 || homeText === null) return null;
    const ws = __sharedUtils.lineWords(homeText);
    const m = new RegExp("(^|\\s)(" + ws.map(__sharedUtils.escapeRe).join("\\s+") + ")(?=\\s|$)").exec(line);
    return m ? { start: m.index + m[1].length, end: m.index + m[1].length + m[2].length } : null;
  })();
  const panelForSpan = (start, element) => {
    if (firstSeparator < 0) {
      if (!plainText || element) return "any";
      return start >= plainText.start && start < plainText.end ? "payload" : "any";
    }
    if (singleIsSecond) {
      if (start >= firstSeparator + separators.separator1.length) return "right";
      return String(homeText || "").trim() ? "payload" : "left";
    }
    if (start < firstSeparator) return "left";
    if (secondSeparator >= 0 && start >= secondSeparator + separators.separator2.length) return "right";
    return "payload";
  };
  let m;
  /* Форма ссылки — общий дом `WIKILINK_TOKEN_SRC`; расхождение ноль
     (`node tools/form_divergence.js`, 10.13.141). */
  const wlRe = new RegExp(__sharedUtils.WIKILINK_TOKEN_SRC, "g");
  while ((m = wlRe.exec(line)) !== null) {
    const v = __sharedUtils.unwrapWikilinkToken(m[0]);
    /* Адрес без подписи: `[[111/имя|имя]]` → `111/имя` (10.13.277); подпись — в `token`. */
    const target = __sharedUtils.wikilinkTargetOf(m[0]) || v;
    if (target) wikilinks.push(target);
    const span = { start: m.index, end: m.index + String(m[0] || "").length };
    wikilinkSpans.push(span);
    wikilinkOccurrences.push({ token: v, target, raw: String(m[0] || ""), ...span, panel: panelForSpan(span.start) });
  }
  const tagRe = /(^|\s)(#[^\s#]+)/g;
  while ((m = tagRe.exec(line)) !== null) {
    tags.push(String(m[2] || "").trim());
    const full = String(m[0] || "");
    const token = String(m[2] || "");
    const idx = m.index + Math.max(0, full.lastIndexOf(token));
    const span = { start: idx, end: idx + token.length };
    tagSpans.push(span);
    tagOccurrences.push({ token: String(m[2] || "").trim(), ...span, panel: panelForSpan(span.start) });
  }
  /* Value Element-списка (`В-247`) узнаётся словом из списка, как тег. */
  const listValues = getElementListValuesFromConfig(cfg);
  if (listValues.size) {
    const wordRe = /\S+/g;
    while ((m = wordRe.exec(line)) !== null) {
      if (!listValues.has(m[0]) || isInSpans(m.index, wikilinkSpans)) continue;
      const span = { start: m.index, end: m.index + m[0].length };
      tags.push(m[0]);
      tagSpans.push(span);
      tagOccurrences.push({ token: m[0], ...span, panel: panelForSpan(span.start) });
    }
  }
  for (let mi = 0; mi < markerRules.length; mi++) {
    const marker = String(markerRules[mi] && markerRules[mi].marker || "").trim();
    if (!marker) continue;
    const emRe = new RegExp(
      `${escapeRegexLiteral(marker)}\\s*(${elementValuePattern(markerRules[mi])})`, "g");
    while ((m = emRe.exec(line)) !== null) {
      if (isInSpans(m.index, wikilinkSpans) || isInSpans(m.index, tagSpans)) continue;
      const value = String(m[1] || "").trim();
      if (value) {
        const span = { start: m.index, end: m.index + String(m[0] || "").length };
        emojis.push({ marker, value });
        emojiOccurrences.push({ marker, value, ...span, panel: panelForSpan(span.start, true) });
      }
    }
  }

  const markerPattern = markerRules.length
    ? markerRules
      .map((r) => `${escapeRegexLiteral(r.marker)}\\s*${elementValuePattern(r)}`)
      .join("|")
    : null;
  /*
   * Слово человека называет тот же дом, что и зоны (У-32): позиционный разбор
   * отдавал под имя значения полей (`## dsf :: #/1 …`). Дом не ответил — прежний разбор.
   */
  const payloadTextRaw = homeText === null
    ? extractPrimaryPayloadText(line, separators)
    : (plainText && markerPattern
      ? homeText.replace(new RegExp(markerPattern, "g"), " ").replace(/\s+/g, " ").trim()
      : homeText);
  /* Форма ссылки — общий дом; сверено с ним, расхождений ноль (10.13.141). */
  let textCore = line
    .replace(new RegExp(__sharedUtils.WIKILINK_TOKEN_SRC, "g"), " ")
    .replace(/(^|\s)(#[^\s#]+)/g, " ")
    .replace(markerPattern ? new RegExp(markerPattern, "g") : /$^/, " ")
    .replace(/\s+/g, " ")
    .trim();
  const payloadParts = textCore.split(String(separators.separator1 || "")).map((s) => String(s || "").trim()).filter(Boolean);
  /*
   * Знак заголовка снимается и без текста за ним: иначе `# #/1 #todo` давала
   * одинокую решётку в имя заметки; теперь — отказ вслух.
   */
  /*
   * Платформенное начало строки — у общего дома (`lineStartOf`, исключение № 81
   * к З3; В-133): номер списка, цитата и каллаут — разметка, а не слово (правило 127).
   */
  const payloadStart = __sharedUtils.lineStartOf(
    String(payloadTextRaw || (payloadParts.length ? payloadParts[0] : textCore) || "")
  );
  /*
   * Знак заголовка без текста за ним текстом не становится: дом строже к пробелу
   * (у Obsidian заголовок — знак и пробел), поэтому случай назван здесь.
   */
  const payloadText = /^\s*#{1,6}\s*$/.test(String(payloadStart.body || "").trim()) || !String(payloadStart.body || "").trim()
    ? ""
    : String(payloadStart.body || "").trim();
  /* Разделители едут с разбором, чтобы читатель не спрашивал конфиг заново (У-32). */
  return { line, tags: uniq(tags), wikilinks: uniq(wikilinks), emojis, payloadText, tagOccurrences, wikilinkOccurrences, emojiOccurrences, separators, singleIsSecond };
}

function getModeFields(cfg) {
  const behavior = isObj(cfg && cfg.pkm && cfg.pkm.fields) ? cfg.pkm.fields : {};
  const left = isObj(behavior.tags) && Array.isArray(behavior.tags.fields) ? behavior.tags.fields : [];
  const right = isObj(behavior.links) && Array.isArray(behavior.links.fields) ? behavior.links.fields : [];
  return left.concat(right).filter((f) => isObj(f) && String(f.id || "").trim());
}

function fieldTokenCandidates(field) {
  const src = Array.isArray(field && field.values) ? field.values : [];
  /* Пустой Prefix — у Element-списка (`В-247`): Value пишется как есть. */
  const prefix = field && field.prefix != null ? String(field.prefix) : "#";
  const out = [];
  for (let i = 0; i < src.length; i++) {
    const row = isObj(src[i]) ? src[i] : {};
    const tok = String(row.token || "").trim();
    if (!tok) continue;
    const full = tok.startsWith("#") ? tok : `${prefix}${tok}`;
    out.push({ fullToken: full, rawToken: tok, yamlProperty: String(row.yamlProperty || "").trim() });
  }
  return out;
}

function fieldWikilinkCandidates(field) {
  const src = Array.isArray(field && field.values) ? field.values : [];
  const out = [];
  for (let i = 0; i < src.length; i++) {
    const row = isObj(src[i]) ? src[i] : {};
    const tok = String(row.token || "").trim();
    if (!tok) continue;
    const bare = tok.startsWith("#") ? String(tok.slice(1)).trim() : tok;
    if (bare) out.push({ token: bare, yamlProperty: String(row.yamlProperty || "").trim() });
  }
  const dedup = [];
  const seen = new Set();
  for (let i = 0; i < out.length; i++) {
    const key = String(out[i] && out[i].token || "");
    if (!key || seen.has(key)) continue;
    seen.add(key);
    dedup.push(out[i]);
  }
  return dedup;
}

function inferFieldType(field) {
  const marker = String(field && field.marker || "").trim();
  const source = String(field && field.source || "").trim().toLowerCase();
  if (marker) return "element";
  if (source.startsWith("wikilinks:")) return "wikilink";
  return "tag";
}

function resolveEffectiveFieldType(field, orderTypes, fieldId) {
  const explicit = String(field && field.type || "").trim().toLowerCase();
  if (explicit) return explicit;
  const byOrder = String(orderTypes && orderTypes[fieldId] || "").trim().toLowerCase();
  if (byOrder) return byOrder;
  return inferFieldType(field);
}

function buildTransformContext(parsed, cfg) {
  const p = isObj(parsed) ? parsed : { line: "", tags: [], wikilinks: [], emojis: [], payloadText: "" };
  const order = isObj(cfg && cfg.pkm && cfg.pkm.fields && cfg.pkm.fields.order) ? cfg.pkm.fields.order : {};
  const propertiesByField = isObj(order.propertiesByField) ? order.propertiesByField : {};
  const orderTypes = isObj(order.types) ? order.types : {};
  const elementsByField = isObj(cfg && cfg.pkm && cfg.pkm.fields && cfg.pkm.fields.elements && cfg.pkm.fields.elements.byField)
    ? cfg.pkm.fields.elements.byField
    : {};
  const fields = getModeFields(cfg);
  /*
   * Block Field говорит Order, а не список определений (B21, B11; ловушка
   * `leftMode`/`rightMode`, И-4, У-9). Дочерний Field — в Block родителя (Ф3).
   */
  const orderSideSet = (key) => new Set((Array.isArray(order[key]) ? order[key] : [])
    .map((id) => String(id || "").trim())
    .filter(Boolean));
  const leftFieldIds = orderSideSet("left");
  const rightFieldIds = orderSideSet("right");
  const fieldById = {};
  for (let i = 0; i < fields.length; i++) {
    const fid = String(fields[i] && fields[i].id || "").trim();
    if (fid) fieldById[fid] = fields[i];
  }
  const wl = Array.isArray(p.wikilinks) ? p.wikilinks : [];
  const emojis = Array.isArray(p.emojis) ? p.emojis : [];

  const byFieldId = {};
  const matches = [];

  /*
   * Значение узнаётся по написанному: в любом Block оно принадлежит своему
   * Field, в слоте текста — слово человека. Block лишь разводит спор двух Fields
   * за один знак: сперва свой Block, потом остальные (В-132, правило 127).
   */
  const claimedOccurrences = new Set();
  const occurrenceKey = (occurrence) => (occurrence
    && Number.isInteger(occurrence.start)
    && Number.isInteger(occurrence.end)
    ? occurrence.start + ":" + occurrence.end
    : "");

  const pushMatch = (fid, fType, markerOrPrefix, yamlProperty, rawToken, occurrence) => {
    const yp = String(yamlProperty || "").trim();
    const rt = String(rawToken || "").trim();
    if (!rt) return;
    const span = occurrence && Number.isInteger(occurrence.start) && Number.isInteger(occurrence.end)
      ? { start: occurrence.start, end: occurrence.end, panel: occurrence.panel }
      : null;
    const key = occurrenceKey(occurrence);
    if (key) claimedOccurrences.add(key);
    byFieldId[fid] = {
      fieldId: fid,
      fieldType: fType,
      fieldPrefix: String(markerOrPrefix || "").trim(),
      yamlProperty: yp,
      rawToken: rt,
      span,
    };
    matches.push({
      fieldId: fid,
      fieldType: fType,
      fieldPrefix: String(markerOrPrefix || "").trim(),
      yamlProperty: yp,
      rawToken: rt,
      span,
    });
  };

  /* Два захода — своё, потом соседнее: занятый знак второй раз не заявляется. */
  for (const pass of ["own", "other"]) {
  for (let i = 0; i < fields.length; i++) {
    const f = fields[i];
    const fid = String(f.id || "").trim();
    if (!fid) continue;
    /* Element в режиме списка — значения как у тега (`В-247`). */
    const fType = __pkmOrderConfig.elementListValues(elementsByField[fid]) ? "tag" : resolveEffectiveFieldType(f, orderTypes, fid);
    const defaultYamlProperty = String(propertiesByField[fid] || "").trim();
    const parentFid = String(f.dependsOn || "").trim();
    const isSubField = !!parentFid;
    const parentYamlProperty = parentFid ? String(propertiesByField[parentFid] || "").trim() : "";
    const resolveYamlProperty = (candidateYamlProperty) => {
      const cand = String(candidateYamlProperty || "").trim();
      if (isSubField) return cand || defaultYamlProperty || parentYamlProperty;
      return cand || defaultYamlProperty;
    };
    /* Дочерний Field стоит в Block родителя: своей строки в Order у него нет. */
    const sideKey = isSubField && !leftFieldIds.has(fid) && !rightFieldIds.has(fid) ? parentFid : fid;
    const expectedPanel = leftFieldIds.has(sideKey)
      ? "left"
      : (rightFieldIds.has(sideKey) ? "right" : "any");
    /*
     * Слот текста не заявляется никогда. Остальное — свой Block первым,
     * соседний вторым, если знак свободен.
     */
    const isPanelMatch = (occurrence) => {
      if (!occurrence) return false;
      const panel = String(occurrence.panel || "");
      if (panel === expectedPanel || panel === "any") return pass === "own";
      if (panel !== "left" && panel !== "right") return false;
      if (pass !== "other") return false;
      const key = occurrenceKey(occurrence);
      return !key || !claimedOccurrences.has(key);
    };

    if (fType === "element") {
      const marker = resolveFieldMarker(f);
      const occurrences = Array.isArray(p.emojiOccurrences) ? p.emojiOccurrences : [];
      for (let oi = 0; oi < occurrences.length; oi++) {
        const occurrence = occurrences[oi];
        if (marker && occurrence.marker === marker && isPanelMatch(occurrence)) {
          pushMatch(fid, fType, marker, resolveYamlProperty(""), `${marker}${occurrence.value}`, occurrence);
        }
      }
      continue;
    }

    if (fType === "wikilink") {
      const wlCandidates = fieldWikilinkCandidates(f);
      for (let wi = 0; wi < wlCandidates.length; wi++) {
        const name = String(wlCandidates[wi] && wlCandidates[wi].token || "").trim();
        if (!name) continue;
        const occurrences = Array.isArray(p.wikilinkOccurrences) ? p.wikilinkOccurrences : [];
        for (let oi = 0; oi < occurrences.length; oi++) {
          const occurrence = occurrences[oi];
          if ((occurrence.target || occurrence.token) !== name || !isPanelMatch(occurrence)) continue;
          const yk = resolveYamlProperty(wlCandidates[wi] && wlCandidates[wi].yamlProperty);
          pushMatch(fid, fType, String(f.prefix || "").trim(), yk, occurrence.raw || `[[${name}]]`, occurrence);
        }
      }
      continue;
    }

    if (fType !== "tag") continue;

    {
      const candidates = fieldTokenCandidates(f);
      for (let ci = 0; ci < candidates.length; ci++) {
        const occurrences = Array.isArray(p.tagOccurrences) ? p.tagOccurrences : [];
        for (let oi = 0; oi < occurrences.length; oi++) {
          const occurrence = occurrences[oi];
          if (occurrence.token !== candidates[ci].fullToken || !isPanelMatch(occurrence)) continue;
          const yk = resolveYamlProperty(candidates[ci].yamlProperty);
          pushMatch(fid, fType, String(f.prefix || "").trim(), yk, candidates[ci].fullToken, occurrence);
        }
      }
    }
  }
  }

  /*
   * Value, чей Field ждёт, в заметку не идёт — спрашивается
   * `isFieldPrerequisiteMet` (знает `Show always` и навигатор; цикл 94, 2026-09-25).
   */
  /* `id` у значений конфига бывает не записан; даём ту же форму, что движкам. */
  const withIds = fields.map((f) => Object.assign({}, f, {
    values: (Array.isArray(f.values) ? f.values : [])
      .map((v) => (isObj(v) && !v.id && v.token ? Object.assign({}, v, { id: String(v.token) }) : v)),
  }));
  const withIdsById = {};
  for (const f of withIds) withIdsById[String(f.id || "").trim()] = f;
  const selectedOnLine = {};
  for (const row of matches) {
    const field = withIdsById[String(row && row.fieldId || "").trim()];
    if (!field) continue;
    const raw = String(row.rawToken || "").trim();
    /* Value — адрес ссылки, подпись к нему не относится (10.13.277). */
    const bare = String(__sharedUtils.wikilinkTargetOf(raw) || __sharedUtils.unwrapWikilinkToken(raw) || raw).trim();
    const prefix = String(field.prefix || "");
    const v = field.values.find((x) => isObj(x) && [raw, bare].some((w) => {
      const tok = String(x.token || "");
      return tok === w || prefix + tok === w;
    }));
    selectedOnLine[row.fieldId] = String(v ? v.id : raw);
  }
  const dependencySafeMatches = matches.filter((row) => __rulesHelpers.isFieldPrerequisiteMet(
    withIdsById[String(row && row.fieldId || "").trim()], selectedOnLine, withIds));
  const dependencySafeByFieldId = {};
  for (let i = 0; i < dependencySafeMatches.length; i++) {
    const row = dependencySafeMatches[i];
    dependencySafeByFieldId[row.fieldId] = row;
  }

  return {
    line: String(p.line || ""),
    payloadText: String(p.payloadText || ""),
    /* Чем оказался единственный разделитель — ответ дома, его спрашивает
       устройство строки после уборки (У-32). */
    singleIsSecond: p.singleIsSecond === true,
    tags: Array.isArray(p.tags) ? p.tags.slice() : [],
    wikilinks: wl.slice(),
    emojis: emojis.slice(),
    byFieldId: dependencySafeByFieldId,
    matches: dependencySafeMatches,
  };
}

function normalizeYamlValueForFormat(rawToken, yamlFormat, row) {
  const mode = String(yamlFormat || "raw").trim().toLowerCase();
  const token = String(rawToken || "").trim();
  const fieldType = String(row && row.fieldType || "").trim().toLowerCase();
  const fieldPrefix = String(row && row.fieldPrefix || "").trim();
  if (!token) return "";
  /* Raw пишет то, что стоит в строке, с маркером элемента (PRD 10.9 Я3). */
  if (mode === "raw") return token;
  if (fieldType === "element") {
    if (fieldPrefix && token.startsWith(fieldPrefix)) return String(token.slice(fieldPrefix.length)).trim();
    const mElement = token.match(/^[\u{1F300}-\u{1FAFF}]\s*(.*)$/u);
    return mElement ? String(mElement[1] || "").trim() : token;
  }
  /*
   * `#/1` остаётся строкой: число Obsidian счёл бы несоответствием типа `tags`
   * (B21); кавычки поставит `needsYamlQuotes`.
   */
  if (/^#\/\d+$/.test(token)) return String(token.replace(/^#\//, "")).trim();
  if (/^#[^\s#]+$/.test(token)) return String(token.slice(1)).trim();
  if (/^[\u{1F300}-\u{1FAFF}]\d{2}:\d{2}$/u.test(token)) return String(token.slice(2)).trim();
  if (/^[\u{1F300}-\u{1FAFF}]\d{4}-\d{2}-\d{2}$/u.test(token)) return String(token.slice(2)).trim();
  if (/^[\u{1F300}-\u{1FAFF}]\d+$/u.test(token)) return String(token.slice(2)).trim();
  /* Ссылка отдаёт адрес, а не подпись: `[[Archive/Old|Old]]` — `Archive/Old`
     (BUGHUNT T22, вид 10.13.277). */
  if (__sharedUtils.isWikilinkToken(token)) return __sharedUtils.wikilinkTargetOf(token);
  return token;
}

/**
 * Правило значения у Field: `raw` или `clean`; пусто — своего нет (PRD 10.9 Я3).
 * Пишет `Note properties` (`yaml_mapping.ts`) ключом `yamlValueRule`.
 */
function normalizeYamlValueRule(raw) {
  const v = String(raw || "").trim().toLowerCase();
  return v === "raw" || v === "clean" ? v : "";
}

/**
 * Типы свойств, объявленные в хранилище (Я4). `app.metadataTypeManager` —
 * приватное API: feature-detect и тихий отказ. Им же читает `yaml_property.ts` (У-32).
 */
function readVaultPropertyTypes(app) {
  const out = {};
  try {
    const mgr = app && typeof app === "object" ? app.metadataTypeManager : null;
    if (!mgr || typeof mgr !== "object") return out;
    const raw = typeof mgr.getAllProperties === "function"
      ? mgr.getAllProperties()
      : (mgr.properties || mgr.types);
    if (!raw || typeof raw !== "object") return out;
    const rows = Array.isArray(raw) ? raw : Object.keys(raw).map((k) => raw[k]);
    for (const row of rows) {
      if (!row || typeof row !== "object") continue;
      const name = String(row.name || "").trim();
      const type = String(row.type || "").trim();
      if (!name || !type) continue;
      if (!out[name]) out[name] = type;
    }
  } catch (_) {
    /* Приватное API имеет право пропасть: это не повод не создать заметку. */
  }
  return out;
}

/**
 * Типы Obsidian со значением-списком; имена сняты с менеджера типов.
 */
const YAML_LIST_PROPERTY_TYPES = new Set(["multitext", "tags", "aliases", "list"]);

function buildYamlMapFromContext(transformContext, cfg, propertyTypes) {
  const out = {};
  const byFieldId = isObj(transformContext && transformContext.byFieldId) ? transformContext.byFieldId : {};
  const rows = withNavigatorRows(Array.isArray(transformContext && transformContext.matches)
    ? transformContext.matches
    : Object.keys(byFieldId).map((k) => byFieldId[k]), cfg);
  const yamlFormat = String(cfg && cfg.transform && cfg.transform.inline2note && cfg.transform.inline2note.yamlNoteFormat || "raw").trim().toLowerCase();
  const order = isObj(cfg && cfg.pkm && cfg.pkm.fields && cfg.pkm.fields.order) ? cfg.pkm.fields.order : {};
  const propertiesByField = isObj(order.propertiesByField) ? order.propertiesByField : {};
  const cardinalityByField = isObj(order.yamlCardinalityByField) ? order.yamlCardinalityByField : {};
  const propertyFieldCounts = {};
  const listYamlKeys = new Set();
  const singleYamlKeys = new Set();
  const configuredFields = getModeFields(cfg);
  /* Определения по id: правило ищется у Field совпадения и у родителя. */
  const fieldDefById = {};
  for (let i = 0; i < configuredFields.length; i++) {
    const fid = String(configuredFields[i] && configuredFields[i].id || "").trim();
    if (fid) fieldDefById[fid] = configuredFields[i];
  }
  /**
   * Правило значения одного совпадения: своё → родительское → общее, как в
   * `buildTransformContext`. У `<name>_sub` своего контрола нет.
   */
  const ruleForFieldId = (fieldId) => {
    const def = fieldDefById[String(fieldId || "").trim()];
    const own = normalizeYamlValueRule(def && def.yamlValueRule);
    if (own) return own;
    const parentId = String(def && def.dependsOn || "").trim();
    const parent = parentId ? fieldDefById[parentId] : null;
    const inherited = normalizeYamlValueRule(parent && parent.yamlValueRule);
    return inherited || yamlFormat;
  };
  for (let i = 0; i < configuredFields.length; i++) {
    const field = configuredFields[i];
    const fid = String(field && field.id || "").trim();
    const keys = new Set();
    const defaultKey = String(propertiesByField[fid] || "").trim();
    if (defaultKey) keys.add(defaultKey);
    const values = Array.isArray(field && field.values) ? field.values : [];
    for (let vi = 0; vi < values.length; vi++) {
      const key = String(values[vi] && values[vi].yamlProperty || "").trim();
      if (key) keys.add(key);
    }
    for (const key of keys) propertyFieldCounts[key] = Number(propertyFieldCounts[key] || 0) + 1;
    const cardinality = String(field && field.yamlCardinality || cardinalityByField[fid] || "").trim().toLowerCase();
    if (cardinality === "list" || cardinality === "many" || cardinality === "array") {
      for (const key of keys) listYamlKeys.add(key);
    } else if (cardinality === "one" || cardinality === "single") {
      for (const key of keys) singleYamlKeys.add(key);
    }
  }
  /*
   * Явный `A list` у любого Field — список; иначе явный `One Value`; иначе
   * догадка по числу Fields (замечание 1.3.2.3).
   */
  for (const key of Object.keys(propertyFieldCounts)) {
    if (propertyFieldCounts[key] > 1 && !singleYamlKeys.has(key)) listYamlKeys.add(key);
  }
  /*
   * Тип, объявленный в хранилище, сильнее догадки и контрола (B21, 2026-09-02).
   * Неизвестное хранилищу — как раньше.
   */
  const declared = propertyTypes && typeof propertyTypes === "object" ? propertyTypes : {};
  for (const key of Object.keys(propertyFieldCounts)) {
    const type = String(declared[key] || "").trim().toLowerCase();
    if (!type) continue;
    if (YAML_LIST_PROPERTY_TYPES.has(type)) {
      listYamlKeys.add(key);
      singleYamlKeys.delete(key);
    }
  }
  for (let i = 0; i < rows.length; i++) {
    const row = isObj(rows[i]) ? rows[i] : {};
    const yamlKey = String(row.yamlProperty || "").trim();
    const rawToken = String(row.rawToken || "").trim();
    if (!yamlKey || !rawToken) continue;
    const value = normalizeYamlValueForFormat(rawToken, ruleForFieldId(row.fieldId), row);
    const isAlwaysListKey = listYamlKeys.has(yamlKey);
    if (!Object.prototype.hasOwnProperty.call(out, yamlKey)) out[yamlKey] = isAlwaysListKey ? [] : value;
    if (isAlwaysListKey) {
      const list = Array.isArray(out[yamlKey]) ? out[yamlKey] : [out[yamlKey]];
      if (!list.includes(value)) list.push(value);
      out[yamlKey] = list;
      continue;
    }
    if (!Array.isArray(out[yamlKey])) {
      if (out[yamlKey] === value) continue;
      out[yamlKey] = [out[yamlKey], value];
      continue;
    }
    if (!out[yamlKey].includes(value)) out[yamlKey].push(value);
  }
  return out;
}

/**
 * `YAML of navigator values` = `On` (PRD 10.13.272, В-227): навигатор ребёнка
 * дописывается совпадением родителя перед ребёнком и идёт в свойство родителя.
 */
function withNavigatorRows(rows, cfg) {
  const fields = getModeFields(cfg);
  const order = isObj(cfg && cfg.pkm && cfg.pkm.fields && cfg.pkm.fields.order) ? cfg.pkm.fields.order : {};
  const propertiesByField = isObj(order.propertiesByField) ? order.propertiesByField : {};
  const out = [];
  const added = new Set();
  for (const row of rows) {
    const child = fields.find((f) => String(f.id) === String(row && row.fieldId || ""));
    const parent = child && child.parentIsNavigator === true && child.yamlNavigator === true
      ? fields.find((f) => String(f.id) === String(child.dependsOn || ""))
      : null;
    const yamlKey = parent ? String(propertiesByField[String(parent.id)] || "").trim() : "";
    if (parent && yamlKey) {
      const raw = String(row.rawToken || "").trim();
      const bare = String(__sharedUtils.wikilinkTargetOf(raw) || __sharedUtils.unwrapWikilinkToken(raw) || raw).trim();
      const cprefix = String(child.prefix || "");
      const cv = (Array.isArray(child.values) ? child.values : [])
        .find((v) => isObj(v) && [raw, bare].some((w) => String(v.token || "") === w || cprefix + String(v.token || "") === w));
      const isLink = String(parent.source || "").indexOf("wikilinks:") === 0;
      for (const ptok of (cv && Array.isArray(cv.allowedParentValues) ? cv.allowedParentValues : [])) {
        const tok = String(ptok || "").trim();
        if (!tok || added.has(tok)) continue;
        added.add(tok);
        out.push({
          fieldId: String(parent.id),
          fieldType: isLink ? "wikilink" : String(row.fieldType || "tag"),
          yamlProperty: yamlKey,
          rawToken: isLink ? __sharedUtils.wikilinkLineToken(tok) : (tok.startsWith("#") ? tok : `${String(parent.prefix || "#")}${tok}`),
        });
      }
    }
    out.push(row);
  }
  return out;
}

function parseFrontmatter(md) {
  const text = String(md || "");
  const newline = text.includes("\r\n") ? "\r\n" : "\n";
  /* Пустой frontmatter `---`/`---` — тоже frontmatter (BUGHUNT 2026-09-30, C11). */
  const m = text.match(/^---\r?\n(?:([\s\S]*?)\r?\n)?---(?:\r?\n)?/);
  if (!m) return { yamlLines: [], body: text, newline };
  const rawYaml = String(m[1] || "");
  const body = String(text.slice(m[0].length) || "");
  const yamlLines = rawYaml ? rawYaml.split(/\r?\n/) : [];
  return { yamlLines, body, newline };
}

function renderYamlBlockWithOrder(existingYamlLines, yamlPatch, cfg) {
  const lines = Array.isArray(existingYamlLines) ? existingYamlLines.slice() : [];
  const patch = isObj(yamlPatch) ? yamlPatch : {};
  const keysExisting = [];
  const keyToLineIndex = {};
  const parseTopLevelKey = (line) => {
    const text = String(line || "");
    if (!text.trim() || /^\s/.test(text) || /^\s*#/.test(text)) return null;
    if (text[0] === '"' || text[0] === "'") {
      const quote = text[0];
      let end = -1;
      for (let i = 1; i < text.length; i++) {
        if (quote === '"' && text[i] === "\\") { i += 1; continue; }
        if (quote === "'" && text[i] === "'" && text[i + 1] === "'") { i += 1; continue; }
        if (text[i] === quote) { end = i; break; }
      }
      if (end < 0 || !/^\s*:/.test(text.slice(end + 1))) {
        throw new Error(`invalid quoted YAML top-level key: ${text}`);
      }
      const lexeme = text.slice(0, end + 1);
      let key;
      try {
        key = quote === '"' ? JSON.parse(lexeme) : lexeme.slice(1, -1).replace(/''/g, "'");
      } catch (_) {
        throw new Error(`invalid quoted YAML top-level key: ${text}`);
      }
      return { key: String(key), lexeme };
    }
    const colon = text.indexOf(":");
    if (colon < 1) return null;
    const lexeme = text.slice(0, colon).trim();
    if (!lexeme || /^[\-?:]/.test(lexeme)) throw new Error(`invalid YAML top-level key: ${text}`);
    return { key: lexeme, lexeme };
  };
  const renderYamlKey = (key) => /^[\p{L}\p{N}_.-]+$/u.test(String(key || "")) ? String(key) : JSON.stringify(String(key));
  for (let i = 0; i < lines.length; i++) {
    const parsedKey = parseTopLevelKey(lines[i]);
    if (!parsedKey) continue;
    const k = parsedKey.key;
    if (!k) continue;
    if (Object.prototype.hasOwnProperty.call(keyToLineIndex, k)) throw new Error(`duplicate YAML top-level key: ${k}`);
    keysExisting.push(k);
    keyToLineIndex[k] = i;
  }

  /*
   * Кавычки — только где без них YAML прочитается иначе (Help → Properties;
   * замечание 1.3.2.4): пусто, ссылка, краевые пробелы, служебный знак в начале,
   * `: ` или `#` внутри, перенос, число/`true`/`null` и родня.
   */
  const YAML_PLAIN_UNSAFE_HEAD = /^[-?:,[\]{}#&*!|>'"%@`]/;
  const YAML_LOOKS_LIKE_NUMBER = /^[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?$/;
  const YAML_LOOKS_LIKE_KEYWORD = /^(?:true|false|yes|no|on|off|null|~)$/i;
  const needsYamlQuotes = (text) => {
    const s = String(text);
    if (!s) return true;
    if (s !== s.trim()) return true;
    if (YAML_PLAIN_UNSAFE_HEAD.test(s)) return true;
    if (/[\n\r]/.test(s)) return true;
    if (s.includes(": ") || s.endsWith(":")) return true;
    if (/\s#/.test(s)) return true;
    if (YAML_LOOKS_LIKE_NUMBER.test(s)) return true;
    if (YAML_LOOKS_LIKE_KEYWORD.test(s)) return true;
    return false;
  };
  const renderYamlText = (value) => {
    const s = String(value ?? "");
    return needsYamlQuotes(s) ? JSON.stringify(s) : s;
  };
  const renderYamlScalar = (value) => {
    if (Array.isArray(value)) {
      return `[${value.map((x) => typeof x === "number" && Number.isFinite(x) ? String(x) : renderYamlText(x)).join(", ")}]`;
    }
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
    if (typeof value === "boolean") return value ? "true" : "false";
    return renderYamlText(value);
  };

  const mergedLines = [];
  for (let i = 0; i < lines.length; i++) {
    const parsedKey = parseTopLevelKey(lines[i]);
    const key = parsedKey ? parsedKey.key : "";
    if (!key || !Object.prototype.hasOwnProperty.call(patch, key)) {
      mergedLines.push(lines[i]);
      continue;
    }
    mergedLines.push(`${parsedKey.lexeme}: ${renderYamlScalar(patch[key])}`);
    while (i + 1 < lines.length && !parseTopLevelKey(lines[i + 1])) i += 1;
  }
  lines.length = 0;
  lines.push(...mergedLines);
  for (const k of Object.keys(keyToLineIndex)) {
    if (!keysExisting.includes(k)) keysExisting.push(k);
  }

  const orderCfg = isObj(cfg && cfg.pkm && cfg.pkm.fields && cfg.pkm.fields.order) ? cfg.pkm.fields.order : {};
  const pbf = isObj(orderCfg.propertiesByField) ? orderCfg.propertiesByField : {};
  const orderLeft = Array.isArray(orderCfg.left) ? orderCfg.left.slice() : [];
  const orderRight = Array.isArray(orderCfg.right) ? orderCfg.right.slice() : [];
  const orderFields = orderLeft.concat(orderRight).map((x) => String(x || "").trim()).filter(Boolean);

  const desiredOrderYamlKeys = [];
  for (let i = 0; i < orderFields.length; i++) {
    const fid = orderFields[i];
    const yk = String(pbf[fid] || "").trim();
    if (!yk) continue;
    if (!desiredOrderYamlKeys.includes(yk)) desiredOrderYamlKeys.push(yk);
  }

  const existingSet = new Set(keysExisting);
  for (let i = 0; i < desiredOrderYamlKeys.length; i++) {
    const k = desiredOrderYamlKeys[i];
    if (!Object.prototype.hasOwnProperty.call(patch, k)) continue;
    if (existingSet.has(k)) continue;
    lines.push(`${renderYamlKey(k)}: ${renderYamlScalar(patch[k])}`);
    existingSet.add(k);
  }

  for (const k of Object.keys(patch)) {
    if (existingSet.has(k)) continue;
    lines.push(`${renderYamlKey(k)}: ${renderYamlScalar(patch[k])}`);
    existingSet.add(k);
  }

  return lines;
}

/**
 * Название заметки из строки-заголовка — её текст (`payloadText`, без значений
 * и разделителей; 2026-09-16). Признак заголовка — у `lineStartOf` (У-32),
 * знающего цитату и каллаут.
 */
function headerTitleOf(parsed) {
  const line = String(parsed && parsed.line || "");
  const start = __sharedUtils.lineStartOf(line);
  if (!start.heading) return "";
  /*
   * Имя заголовка — то, что между находками разбора (тегами, ссылками,
   * элементами), а не слот текста: на `## ва :: #/1` в слоте стоит значение.
   */
  const spans = []
    .concat(Array.isArray(parsed.tagOccurrences) ? parsed.tagOccurrences : [])
    .concat(Array.isArray(parsed.wikilinkOccurrences) ? parsed.wikilinkOccurrences : [])
    .concat(Array.isArray(parsed.emojiOccurrences) ? parsed.emojiOccurrences : [])
    .filter((s) => Number(s && s.end) > start.at)
    .sort((a, b) => Number(a.start) - Number(b.start));
  let out = "";
  let at = start.at;
  for (const span of spans) {
    const from = Math.max(at, Number(span.start) || 0);
    if (from > at) out += line.slice(at, from);
    at = Math.max(at, Number(span.end) || 0);
  }
  out += line.slice(at);
  const separators = isObj(parsed && parsed.separators) ? parsed.separators : {};
  for (const sep of [separators.separator1, separators.separator2]) {
    if (sep) out = out.split(sep).join(" ");
  }
  return out.replace(/\s+/g, " ").trim();
}

/**
 * Как записано явное имя — пара скобок и текст. Одно объявление для чтения
 * (`explicitTitleOf`) и двух снятий со строки (У-32).
 */
function explicitTitleDelimiters(i2n) {
  const delim = String(i2n && i2n.noteName && i2n.noteName.delimiters || "[]").trim() || "[]";
  const open = delim.slice(0, Math.max(1, Math.floor(delim.length / 2))) || "[";
  const close = delim.slice(open.length) || "]";
  return { open, close };
}

function explicitTitleRegExp(i2n, flags) {
  const { open, close } = explicitTitleDelimiters(i2n);
  return new RegExp(
    escapeRegexLiteral(open) + "([\\s\\S]*?)" + escapeRegexLiteral(close),
    String(flags || ""));
}

/**
 * Явное имя в скобках или пусто. Нужно дважды: имя ещё и снимается со строки (R4).
 */
function explicitTitleOf(line, i2n) {
  const re = explicitTitleRegExp(i2n, "g");
  /*
   * Начало строки — у общего дома (`lineStartOf`, У-91): номер и каллаут иначе
   * уезжали в имя (H2). Имя в скобках читается раньше `payloadStart` (В-133, У-159).
   */
  const lineWithoutWikilinks = String(__sharedUtils.lineStartOf(String(line || "")).body || "")
    /* Форма ссылки — общий дом (10.13.141). */
    .replace(new RegExp(__sharedUtils.WIKILINK_TOKEN_SRC, "g"), " ")
    /* Ссылка Markdown `[текст](адрес)` — не имя в скобках (BUGHUNT T8). */
    .replace(new RegExp(__sharedUtils.MARKDOWN_LINK_SRC, "g"), " ")
    /* Сноска `[^1]` — разметка Obsidian, а не имя в скобках (BUGHUNT 2026-09-30, C5). */
    .replace(/\[\^[^\]\s]+\]/g, " ");
  let m;
  while ((m = re.exec(lineWithoutWikilinks)) !== null) {
    const explicit = String(m[1] || "").trim();
    if (explicit) return explicit;
  }
  return "";
}

/**
 * Разрезать текст по месту явного имени: `{ head, tail, found }`. Ссылка
 * встаёт туда, где было имя: `[тест-трансформ] тест1` → `[[333/тест-трансформ]] тест1`.
 */
function splitByExplicitTitle(text, explicitTitle, i2n) {
  const src = String(text || "");
  const title = String(explicitTitle || "").trim();
  if (!title) return { head: src.trim(), tail: "", found: false };
  const re = explicitTitleRegExp(i2n, "g");
  let m;
  while ((m = re.exec(src)) !== null) {
    if (String(m[1] || "").trim() !== title) continue;
    return {
      head: String(src.slice(0, m.index) || "").trim(),
      tail: String(src.slice(m.index + String(m[0] || "").length) || "").trim(),
      found: true,
    };
  }
  return { head: src.trim(), tail: "", found: false };
}

/** Снять со строки то, что стало названием заметки. */
/**
 * Разрезать текст по месту слов, ставших названием. Снимаются по одному и по
 * порядку: между ними может стоять Value, которого `payloadText` не видит.
 * Не нашлись все — разреза нет (имя могли набрать в окне вручную).
 */
function splitByTitleWords(text, titleWords) {
  const src = String(text || "");
  const words = String(titleWords || "").trim().split(/\s+/).filter(Boolean);
  if (!words.length) return { head: src.trim(), tail: "", found: false };
  const tokens = [];
  const re = /\S+/g;
  let m;
  while ((m = re.exec(src)) !== null) tokens.push(m[0]);
  const consumed = new Set();
  let wordIdx = 0;
  let lastIdx = -1;
  for (let i = 0; i < tokens.length && wordIdx < words.length; i++) {
    if (tokens[i] !== words[wordIdx]) continue;
    consumed.add(i);
    lastIdx = i;
    wordIdx++;
  }
  if (wordIdx < words.length || lastIdx < 0) return { head: src.trim(), tail: "", found: false };
  return {
    head: tokens.filter((_, i) => i < lastIdx && !consumed.has(i)).join(" "),
    tail: tokens.slice(lastIdx + 1).join(" "),
    found: true,
  };
}

/**
 * Где стояло название — один ответ на оба его вида (скобки или первые слова).
 */
function splitByTitleSource(text, explicitTitle, titleWords, i2n) {
  const explicit = splitByExplicitTitle(text, explicitTitle, i2n);
  if (explicit.found) return explicit;
  return splitByTitleWords(text, titleWords);
}

function stripExplicitTitleFromLine(line, explicitTitle, i2n) {
  const src = String(line || "");
  const parts = splitByExplicitTitle(src, explicitTitle, i2n);
  if (!parts.found) return src;
  const indent = String((src.match(/^[\t ]*/) || [""])[0] || "");
  const body = [parts.head.slice(indent.length), parts.tail]
    .filter((x) => String(x || "").length)
    .join(" ");
  return `${indent}${body}`.replace(/\s{2,}/g, " ").trimEnd();
}

/** То же для блока строк: имя стояло в корневой, дочерние не трогаем. */
function stripExplicitTitleFromBlock(blockText, explicitTitle, i2n) {
  const lines = String(blockText || "").split("\n");
  if (!lines.length) return String(blockText || "");
  lines[0] = stripExplicitTitleFromLine(lines[0], explicitTitle, i2n);
  return lines.join("\n");
}

/**
 * Откуда взялось название и какой кусок строки им стал. Порядок «скобки →
 * заголовок → первые слова» объявлен только здесь (У-32).
 *
 * `origin`:
 *   `explicit` — имя в скобках `naming-delimiters`; со строки уходит всегда;
 *   `header`   — заголовок строки;
 *   `words`    — первые `wordCount` слов; уходят, только где текст и так не
 *                сохраняется целиком (T1);
 *   `""`       — названия нет.
 */
function resolveAutoTitleInfo(parsed, i2n) {
  const line = String(parsed && parsed.line || "");
  const payload = String(parsed && parsed.payloadText || "").trim();
  const explicit = explicitTitleOf(line, i2n);
  if (explicit) return { title: explicit, origin: "explicit" };
  if (i2n && i2n.noteName && i2n.noteName.preferHeaderTitle) {
    const hh = headerTitleOf(parsed);
    if (hh) return { title: hh, origin: "header" };
  }
  const base = payload && payload !== "-" ? payload : "";
  const wordsN = Math.max(1, Math.min(32, Math.trunc(Number(i2n && i2n.noteName && i2n.noteName.wordCount) || 6)));
  /* Ссылка с пробелом — одно слово (`lineWords`, BUGHUNT R1). */
  const words = __sharedUtils.lineWords(base).slice(0, wordsN);
  if (words.length) return { title: words.join(" "), origin: "words" };
  return { title: "", origin: "" };
}

function resolveAutoTitle(parsed, i2n) {
  return resolveAutoTitleInfo(parsed, i2n).title;
}

/**
 * Какой кусок исходной строки стал названием — один ответ для переноса и
 * предпросмотра (У-150). Заголовок отвечает как слова: его текст стоит на строке
 * (G2, В-128). Имя, набранное вручную, проверяется на совпадение.
 */
function resolveTitleSwap(parsed, i2n, resolvedTitle) {
  const line = String(parsed && parsed.line || "");
  const titled = resolveAutoTitleInfo(parsed, i2n);
  const title = String(resolvedTitle == null ? titled.title : resolvedTitle).trim();
  const explicit = String(explicitTitleOf(line, i2n) || "").trim();
  if (explicit && title === explicit) return { explicitTitle: title, titleWords: "" };
  const fromLine = titled.origin === "words" || titled.origin === "header";
  if (title && fromLine && title === String(titled.title || "").trim()) {
    return { explicitTitle: "", titleWords: titled.title };
  }
  return { explicitTitle: "", titleWords: "" };
}

function promptNoteTitleWithModal(plugin, ModalClass) {
  if (!plugin || !plugin.app || typeof ModalClass !== "function") {
    throw new Error("Obsidian Modal unavailable for manual note naming");
  }
  return new Promise((resolve) => {
    let settled = false;
    const finish = (value) => {
      if (settled) return;
      settled = true;
      resolve(value);
    };
    class NoteTitleModal extends ModalClass {
      onOpen() {
        this.titleEl.setText("Inline2Note: note title");
        /*
         * Вид — классами (Р7); правила в `styles.css`, «Окна плагина вне панели».
         */
        const input = this.contentEl.createEl("input", { type: "text", cls: "io-i2n-title__input" });
        input.setAttribute("aria-label", "Note title");
        /* Пустое имя не молчит: подсказка в поле и недоступная `Create`
           (BUGHUNT 2026-09-30, C24). */
        input.setAttribute("placeholder", "Type a name for the new note");
        const buttons = this.contentEl.createDiv({ cls: "io-i2n-title__actions" });
        const cancel = buttons.createEl("button", { text: "Cancel" });
        const submit = buttons.createEl("button", { text: "Create" });
        submit.classList.add("mod-cta");
        const syncSubmit = () => { submit.disabled = !String(input.value || "").trim(); };
        syncSubmit();
        input.addEventListener("input", syncSubmit);
        const submitValue = () => {
          const value = String(input.value || "").trim();
          if (!value) {
            input.focus();
            return;
          }
          finish(value);
          this.close();
        };
        cancel.addEventListener("click", () => this.close());
        submit.addEventListener("click", submitValue);
        input.addEventListener("keydown", (event) => {
          if (event.key === "Enter") submitValue();
          else if (event.key === "Escape") this.close();
        });
        setTimeout(() => input.focus(), 0);
      }
      onClose() {
        this.contentEl.empty();
        finish(null);
      }
    }
    new NoteTitleModal(plugin.app).open();
  });
}

async function resolveNoteTitle(plugin, parsed, i2n, runtimeOptions) {
  const mode = String(i2n && i2n.noteName && i2n.noteName.mode || "auto").trim().toLowerCase();
  if (mode !== "manual") return resolveAutoTitle(parsed, i2n);
  const ModalClass = runtimeOptions && runtimeOptions.Modal;
  return promptNoteTitleWithModal(plugin, ModalClass);
}

function sanitizeResolvedTitle(raw) {
  const s = String(raw || "").trim();
  if (!s || s === "-") return "";
  return s;
}

/**
 * Имя файла из названия. Ссылка даёт свой текст (подпись или имя без папки),
 * ссылка Markdown — текст (BUGHUNT R6: T6, T8, T1; Г-3): `[[` внутри `[[…]]`
 * Obsidian не читает. `#`, `^`, `[`, `]` и запрещённые ФС знаки убираются.
 */
/* Путь на Windows упирается в 260 знаков — ENOENT (BUGHUNT 2026-09-30, C6). */
/* ponytail: предел в знаках имени, а не во всём пути; мерить путь целиком, если упрётся глубокая папка. */
const TITLE_MAX_CHARS = 100;
function slugSafeTitle(raw) {
  const flat = String(raw || "")
    .trim()
    .replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_m, target, alias) => alias || String(target).split("/").pop())
    .replace(new RegExp(__sharedUtils.MARKDOWN_LINK_SRC, "g"), "$1")
    .replace(/[\\/:*?"<>|#^[\]]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  /* Точка в начале — скрытый файл, Obsidian его не видит (C7); точку и пробел
     в конце Windows снимает сам, и ссылка расходится с файлом. */
  const chars = Array.from(flat.replace(/^[.\s]+/, ""));
  if (chars.length <= TITLE_MAX_CHARS) return chars.join("").replace(/[.\s]+$/, "");
  /* Режется по слову, если от имени остаётся хотя бы половина. */
  const hard = chars.slice(0, TITLE_MAX_CHARS).join("");
  const soft = hard.replace(/\s+\S*$/, "");
  return (soft.length * 2 >= hard.length ? soft : hard).replace(/[.\s]+$/, "");
}

/**
 * Папка новой заметки (10.13.8): `default` — как `New notes folder`; `near` —
 * рядом с текущей; `folder` — своя папка правила, пустая значит `default`.
 */
function resolveRuleFolder(rule, i2n) {
  const mode = normalizeRuleFolderMode(rule && rule.targetFolderMode);
  if (mode === "near") return "";
  if (mode === "folder") {
    const own = normalizeFolderPath(rule && rule.targetFolder);
    if (own) return own;
  }
  return normalizeFolderPath(i2n && i2n.outputFolder);
}

/**
 * Повторный Transform дописывает в ту же заметку (`В-240`; BUGHUNT T24): строка
 * уже превращена (её текст — одна ссылка на существующую заметку) или
 * возвращена отменой (память `_i2nMade` до перезапуска).
 */
/* Ключ памяти «заметка, заведённая с этой строки»: заметка-источник и строка. */
function madeKey(sourcePath, sourceLine) { return String(sourcePath || "") + "\n" + String(sourceLine); }

function sameNoteAgain(plugin, parsed, sourceLine, sourcePath) {
  const app = plugin && plugin.app;
  if (!app || !app.vault) return null;
  const words = __sharedUtils.lineWords(parsed && parsed.payloadText);
  let path = "";
  if (words.length === 1 && __sharedUtils.isWikilinkToken(words[0])) {
    const linked = __sharedUtils.wikilinkTargetOf(words[0]);
    const cache = app.metadataCache;
    const file = cache && typeof cache.getFirstLinkpathDest === "function"
      ? cache.getFirstLinkpathDest(linked, sourcePath || "")
      : app.vault.getAbstractFileByPath(linked + ".md");
    path = file && file.path ? String(file.path) : "";
  } else {
    /* Память знает заметку-источник: та же строка в другой заметке — новая заметка (C3). */
    const made = plugin._i2nMade ? plugin._i2nMade.get(madeKey(sourcePath, sourceLine)) : "";
    if (made && app.vault.getAbstractFileByPath(made)) path = made;
  }
  return path ? { mode: "add_to_note", path, basePath: path, exists: true } : null;
}

async function pickTargetPath(plugin, title, i2n, rule) {
  const app = plugin.app;
  let folder = resolveRuleFolder(rule, i2n);
  if (!folder) {
    try {
      const activeFile = app && app.workspace && typeof app.workspace.getActiveFile === "function" ? app.workspace.getActiveFile() : null;
      /*
       * Папка активной заметки нормализуется: в корне Obsidian отдаёт
       * `parent.path === "/"`, и ссылка выходила `[[//тест]]` (B21).
       */
      folder = normalizeFolderPath(activeFile && activeFile.parent ? activeFile.parent.path : "");
    } catch (_) {
      /*
       * Проба: у заметки в корне родителя может не быть. «Нет» — ответ:
       * `folder` пуст, заметка ляжет в корень.
       */
    }
  }
  const baseTitle = slugSafeTitle(title) || "inline2note";
  const mode = String(i2n && i2n.nameCollision && i2n.nameCollision.mode || "new_note").trim().toLowerCase();
  const basePath = folder ? `${folder}/${baseTitle}.md` : `${baseTitle}.md`;
  const exists = app.vault.getAbstractFileByPath(basePath);
  if (!exists) return { mode, path: basePath, basePath, exists: false };
  if (mode === "overwrite" || mode === "add_to_note") return { mode, path: basePath, basePath, exists: true };
  let idx = 1;
  while (idx < 1000) {
    const suffix = String(idx).padStart(2, "0");
    const p = folder ? `${folder}/${baseTitle}-${suffix}.md` : `${baseTitle}-${suffix}.md`;
    if (!app.vault.getAbstractFileByPath(p)) return { mode: "new_note", path: p, basePath, exists: false };
    idx += 1;
  }
  throw new Error(`cannot allocate unique note path for ${basePath}`);
}

function deriveSourceWikilinkFromTargetPath(targetPath) {
  return String(targetPath || "").trim().replace(/\\/g, "/").replace(/\.md$/i, "");
}

/**
 * Папка заметки; пусто — корень vault. `replace(/\/[^/]*$/, "")` в корне отдал
 * бы имя заметки как папку. Одно правило на оба места записи (У-32).
 */
function folderOfNotePath(notePath) {
  const src = String(notePath || "").trim().replace(/\\/g, "/");
  const at = src.lastIndexOf("/");
  return at < 0 ? "" : src.slice(0, at);
}

/**
 * Куда ссылается строка — значениями полей типа link, а не всякой ссылкой
 * (В-135): ссылка в тексте — слово человека. Цели в порядке строки, без повторов.
 */
function backlinkTargetsFromContext(context, cfg) {
  const rows = Array.isArray(context && context.matches) ? context.matches : [];
  const off = notMocFieldIds(cfg);
  const out = [];
  const seen = new Set();
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (!row || String(row.fieldType || "") !== "wikilink") continue;
    if (off.has(String(row.fieldId || "").trim())) continue;
    /* Адрес, а не подпись: `[[111/имя|имя]]` ведёт в `111/имя` (10.13.277). */
    const target = String(__sharedUtils.wikilinkTargetOf(String(row.rawToken || "")) || "").trim();
    if (!target || seen.has(target)) continue;
    seen.add(target);
    out.push(target);
  }
  return out;
}

/**
 * Link, который не MOC (цикл 98, тест 3): к нему backlinks не применяются.
 * Карта — `useAsMoc` в Order; `false` — «нет», нет ключа — «да». Отдаёт id полей.
 */
function notMocFieldIds(cfg) {
  const fields = isObj(cfg) && isObj(cfg.pkm) && isObj(cfg.pkm.fields) ? cfg.pkm.fields : {};
  const map = isObj(fields.order) && isObj(fields.order.useAsMoc) ? fields.order.useAsMoc : {};
  const off = new Set(Object.keys(map).filter((k) => map[k] === false).map((k) => String(k).trim()));
  if (!off.size) return off;
  const links = isObj(fields.links) && Array.isArray(fields.links.fields) ? fields.links.fields : [];
  for (const f of links) if (f && off.has(String(f.orderKey || "").trim())) off.add(String(f.id || "").trim());
  return off;
}

/** Values полей, которые не MOC: навигатор такого поля заметкой-MOC не становится. */
function notMocTargets(cfg) {
  const off = notMocFieldIds(cfg);
  const out = new Set();
  if (!off.size) return out;
  const links = isObj(cfg.pkm.fields.links) && Array.isArray(cfg.pkm.fields.links.fields) ? cfg.pkm.fields.links.fields : [];
  for (const f of links) {
    if (!f || !off.has(String(f.id || "").trim())) continue;
    for (const v of Array.isArray(f.values) ? f.values : []) {
      const tok = String(v && v.token || v || "").trim();
      if (tok) out.add(normalizeRuleWikilink(tok));
    }
  }
  return out;
}

/**
 * Цели ссылки вместе с навигаторами (`Link to Navigator`, PRD 10.13.272, В-225):
 * при `On` заметка навигатора тоже получает ссылку. Навигатор-тег — не
 * заметка; уже стоящий на строке не повторяется.
 */
function backlinkTargetsWithNavigators(context, cfg, i2n) {
  const targets = backlinkTargetsFromContext(context, cfg);
  if (!(isObj(i2n && i2n.backlink) && i2n.backlink.navigator === true)) return targets;
  const seen = new Set(targets.map(normalizeRuleWikilink));
  /* Навигатор ищется по всем ссылкам строки, и по ребёнку-не-MOC: MOC решает
     лишь, писать ли в заметку. */
  const all = backlinkTargetsFromContext(context).map(normalizeRuleWikilink);
  const present = { tags: new Set(), wikilinks: new Set(all), emojiMarkers: new Set() };
  addNavigatorsOfChildren(cfg, present);
  const off = notMocTargets(cfg);
  for (const w of present.wikilinks) if (!seen.has(w) && !all.includes(w) && !off.has(w)) targets.push(w);
  return targets;
}

/**
 * Путь заметки значения поля — у платформы (`getFirstLinkpathDest`, У-91).
 * «Нет такой» — путь из значения, её заведут (В-135). Спрашивается от
 * `sourcePath`, как щелчок (`openLinkText`, `app.js` 1.13.7): у одноимённых
 * заметок ответ от этого зависит (цикл 95, тест 2).
 */
function resolveBacklinkNotePath(app, target, sourcePath) {
  /* Подпуть (`#Раздел`, `#^блок`) — не имя заметки (ревизия Г-4). */
  const linkpath = String(target || "").split("#")[0].trim();
  if (!linkpath) return "";
  const cache = app && app.metadataCache;
  if (cache && typeof cache.getFirstLinkpathDest === "function") {
    const dest = cache.getFirstLinkpathDest(linkpath, String(sourcePath || ""));
    const path = String(dest && dest.path || "").trim();
    if (path) return path;
  }
  return /\.md$/i.test(linkpath) ? linkpath : `${linkpath}.md`;
}

/**
 * Есть ли в заметке ссылка на нашу. Сравнивается цель, а не текст: полный путь,
 * короткое имя и подпись через `|` — одно (`unwrapWikilinkToken`).
 */
function noteAlreadyLinksTo(body, targetPath) {
  const wanted = deriveSourceWikilinkFromTargetPath(targetPath);
  if (!wanted) return false;
  const wantedShort = wanted.replace(/^.*\//, "");
  const re = new RegExp(__sharedUtils.WIKILINK_TOKEN_SRC, "g");
  const src = String(body == null ? "" : body);
  let m;
  while ((m = re.exec(src)) !== null) {
    const found = String(__sharedUtils.wikilinkTargetOf(m[0]) || __sharedUtils.unwrapWikilinkToken(m[0]) || "").trim().replace(/\.md$/i, "");
    if (!found) continue;
    if (found === wanted) return true;
    /* Короткое имя — та же заметка, только если в нём нет пути: `[[ава]]` = `333/ава`,
       а `111/ава` ≠ `333/ава`. */
    if (!found.includes("/") && found === wantedShort) return true;
  }
  return false;
}

/**
 * Строка в чужую заметку. Знак списка — иначе Obsidian склеит её с соседней в
 * абзац; путь полный (В-135): одноимённые иначе неразличимы.
 */
function backlinkLineFor(targetPath) {
  const link = deriveSourceWikilinkFromTargetPath(targetPath);
  return link ? `- [[${link}]]` : "";
}

/**
 * Ссылка на новую заметку — в каждую заметку, на которую ссылалась строка (Н4).
 * Через `Vault.process` (Р8). Отказ громкий и не роняющий: у каждой цели свой
 * заход, заметка и строка уже сделаны.
 */
async function writeBacklinksIntoReferencedNotes(plugin, context, targetPath, i2n, pluginCfg, sourcePath) {
  const cfg = isObj(i2n && i2n.backlink) ? i2n.backlink : {};
  if (cfg.enabled !== true) return { written: [], skipped: [], failed: [] };
  const line = backlinkLineFor(targetPath);
  const written = [];
  const skipped = [];
  const failed = [];
  if (!line) return { written, skipped, failed };
  const app = plugin && plugin.app;
  const vault = app && app.vault;
  if (!vault) throw new Error("vault unavailable for backlink write");
  const selfPath = String(targetPath || "").trim();
  /* Цели-значения — Value полей; навигаторы добавляются к ним отдельно. */
  const valueTargets = new Set(backlinkTargetsFromContext(context, pluginCfg));
  for (const target of backlinkTargetsWithNavigators(context, pluginCfg, i2n)) {
    const path = resolveBacklinkNotePath(app, target, sourcePath);
    /* Ссылка на самоё себя не пишется. */
    if (!path || path === selfPath) { skipped.push(target); continue; }
    try {
      let af = vault.getAbstractFileByPath(path);
      /*
       * Заметку Value, которой нет, не заводим (`В-244`); заметку навигатора
       * заводим (В-135).
       */
      if (!af && valueTargets.has(target)) { skipped.push(target); continue; }
      if (!af) {
        const folderPath = folderOfNotePath(path);
        if (folderPath && !vault.getAbstractFileByPath(folderPath)) await vault.createFolder(folderPath);
        /* В-135: заметки-цели нет — создать пустую и дописать. */
        await vault.create(path, "");
        af = vault.getAbstractFileByPath(path);
      }
      if (!af) throw new Error(`note not found after create: ${path}`);
      let touched = false;
      await vault.process(af, (data) => {
        const previous = String(data == null ? "" : data);
        if (noteAlreadyLinksTo(previous, targetPath)) return previous;
        touched = true;
        return appendBlockIntoNote(previous, line, cfg, previous.includes("\r\n") ? "\r\n" : "\n");
      });
      if (touched) written.push(path);
      else skipped.push(path);
    } catch (error) {
      failed.push(path);
      /*
       * Второй вид отказа: чужая заметка недоступна на запись — журнал
       * единственное место, где сказано почему.
       */
      console.error("[inline-overhaul][inline2note] ссылка не дописана в заметку "
        + path + ": " + String((error && error.message) || error || ""));
    }
  }
  return { written, skipped, failed };
}

/**
 * Разбор исходной строки на «до текста», текст и «после текста»; склейка
 * обратно — `joinSourcePayload` (при пустом хвосте второй Separator не пишется).
 *
 * Один Separator на строке — два устройства (`text :: right` и `left :: text`),
 * текстом неразличимые (T4). `shape.payloadFirst` от `planSourceCleanup`
 * говорит, что оставшийся Separator — второй и текст стоит до него.
 */
function splitSourcePayload(line, separators, shape) {
  const src = String(line || "");
  const indent = String((src.match(/^[\t ]*/) || [""])[0] || "");
  const body = src.slice(indent.length);
  const s1 = String(separators && separators.separator1 || "").trim();
  const s2 = String(separators && separators.separator2 || "").trim();
  if (s1 && s2 && body.includes(s1) && body.includes(s2)) {
    const firstIdx = body.indexOf(s1);
    const secondIdx = body.indexOf(s2, firstIdx + s1.length);
    if (firstIdx >= 0 && secondIdx > firstIdx) {
      return {
        kind: "both", src, indent, s1, s2,
        left: String(body.slice(0, firstIdx) || "").trimEnd(),
        payload: String(body.slice(firstIdx + s1.length, secondIdx) || "").trim(),
        right: String(body.slice(secondIdx + s2.length) || "").trim(),
      };
    }
  }
  if (s1 && body.includes(s1)) {
    const firstIdx = body.indexOf(s1);
    if (firstIdx >= 0) {
      if (shape && shape.payloadFirst) {
        const head = String(body.slice(0, firstIdx) || "");
        /* Начало строки — общего дома: номер, цитата и заголовок тоже (BUGHUNT T2). */
        const prefix = String(__sharedUtils.lineStartOf(head).prefix || "");
        return {
          kind: "payload-right", src, indent, s1, s2, prefix,
          payload: String(head.slice(prefix.length) || "").trim(),
          right: String(body.slice(firstIdx + s1.length) || "").trim(),
        };
      }
      return {
        kind: "left-only", src, indent, s1, s2,
        left: String(body.slice(0, firstIdx) || "").trimEnd(),
        payload: String(body.slice(firstIdx + s1.length) || "").trim(),
      };
    }
  }
  /*
   * Начало строки остаётся строке, текст — тексту (BUGHUNT T2, T3; `В-239`
   * «сохранять чекбокс человека»); начало — у `lineStartOf`.
   */
  const start = __sharedUtils.lineStartOf(src);
  if (String(start.body || "").trim()) {
    return { kind: "bullet", src, s1, s2, prefix: String(start.prefix || ""), payload: String(start.body || "").trim() };
  }
  /* Ни Separator, ни маркера списка: читать нечего, дописывать — в конец. */
  return { kind: "none", src, s1, s2, payload: "" };
}

/**
 * Собрать строку с новым текстом на месте прежнего. Пустые куски не дают
 * двойных пробелов между Separator и ведущего пробела.
 */
function joinSourcePayload(parts, payload) {
  const p = String(payload || "").trim();
  const glue = (...bits) => bits.filter((x) => String(x || "").length).join(" ");
  if (parts.kind === "both") {
    if (parts.right) return `${parts.indent}${glue(parts.left, parts.s1, p, parts.s2, parts.right)}`;
    return `${parts.indent}${glue(parts.left, parts.s1, p)}`;
  }
  if (parts.kind === "left-only") return `${parts.indent}${glue(parts.left, parts.s1, p)}`;
  /*
   * Левого сегмента нет, Separator один — между текстом и правой частью. Пустой
   * текст слот оставляет: иначе правая часть слилась бы с прозой (У-74).
   */
  if (parts.kind === "payload-right") {
    if (parts.right) return `${parts.indent}${parts.prefix}${glue(p, parts.s2, parts.right)}`;
    return `${parts.indent}${parts.prefix}${p}`.trimEnd();
  }
  if (parts.kind === "bullet") return `${parts.prefix}${p}`;
  if (parts.s1 && parts.s2) return `${parts.src} ${parts.s1} ${p}`;
  return `${parts.src} ${p}`;
}

/** Первые `count` слов текста: остальное уходит вместе с ним в заметку. */
function firstWordsOf(text, count) {
  const words = String(text || "").trim().split(/\s+/).filter(Boolean);
  const take = Number.isFinite(Number(count)) ? Math.max(1, Math.trunc(Number(count))) : 1;
  return words.slice(0, take).join(" ");
}

/** Сколько слов запрошено: ноль слов не бывает, остаётся одно. */
function keepWordsCount(count) {
  return Number.isFinite(Number(count)) ? Math.max(1, Math.trunc(Number(count))) : 1;
}

function applySourcePayloadReplace(line, noteTitle, separators) {
  const src = String(line || "");
  const title = String(noteTitle || "").trim();
  if (!title) return src;
  return joinSourcePayload(splitSourcePayload(line, separators), `[[${title}]]`);
}

/**
 * Судьба текста исходной строки и ссылка — две разные вещи (2026-09-01).
 *
 * `text`:
 *   `leave`  — текст остаётся целиком;
 *   `remove` — текст уходит в заметку и со строки убирается;
 *   `words`  — на строке остаются первые `keepWords` слов.
 *
 * Явное имя в скобках (R4) и слова, из которых собралось название (T1), со
 * строки уходят, в счёт `keepWords` не идут, ссылка встаёт на их место:
 *
 *   было   `- [ ] #todo :: [тест-трансформ] тест1 :: 📅2026-09-07 11:25`
 *   стало  `- [[333/тест-трансформ]] тест1 :: #processed`
 *
 * Имена приходят в `explicitTitle`/`titleWords` от `resolveAutoTitleInfo` (У-32);
 * пусто — порядок «текст, потом ссылка».
 */
function applySourceTextFate(line, noteTitle, separators, opts) {
  const src = String(line || "");
  const fate = oneOfOrDefault(opts && opts.text, ["leave", "remove", "words", "leave_named"], "remove");
  const link = !!(opts && opts.link);
  const title = String(noteTitle || "").trim();
  const linkText = link && title ? ("[[" + title + "]]") : "";
  const parts = splitSourcePayload(line, separators, opts && opts.shape);
  /*
   * Слова названия снимаются, только где на их место встаёт ссылка и положение
   * это позволяет: `leave` обещает строку как была, при `remove` снимать нечего
   * (T1, В-78). `leave_named` — текст целиком без слов названия, без счёта слов.
   * Имя в скобках уходит при любом положении.
   */
  const swapsName = fate === "words" || fate === "leave_named";
  const titleWords = linkText && swapsName ? (opts && opts.titleWords) : "";
  const named = splitByTitleSource(parts.payload, opts && opts.explicitTitle, titleWords, opts && opts.i2n);
  /*
   * Текст остаётся, ссылки нет — строку не трогаем: склейка нормализует пробелы
   * вокруг Separator. Исключение — имя в скобках.
   */
  if ((fate === "leave" || fate === "leave_named") && !linkText && !named.found) return src;
  let head = named.head;
  let tail = named.tail;
  if (fate === "remove") {
    head = "";
    tail = "";
  } else if (fate === "words") {
    const budget = keepWordsCount(opts && opts.keepWords);
    head = firstWordsOf(head, budget);
    const left = budget - head.split(/\s+/).filter(Boolean).length;
    tail = left > 0 ? firstWordsOf(tail, left) : "";
  }
  const next = [head, linkText, tail].filter(Boolean).join(" ");
  return joinSourcePayload(parts, next);
}

/**
 * Зоны исходной строки для метки: начало, значения, текст, правый Block — у
 * дома (`splitSegments`). Правила не собрались — позиционный ответ (проба).
 * Начало строки снимается всегда общим объявлением (У-184).
 */
function sourceLineZones(line, separators, cfg) {
  const src = String(line || "");
  const s1 = String(separators && separators.separator1 || "").trim();
  const s2 = String(separators && separators.separator2 || "").trim();
  let seg = null;
  if (cfg) {
    try {
      seg = __linePipeline.splitSegments(src, getRulesShapeModule().buildRulesForEngines(cfg));
    } catch (_) {
      /* Правила не собрались — ниже позиционный ответ. Проба, и «нет» — ответ. */
      seg = null;
    }
  }
  if (!seg) {
    const indentOnly = String((src.match(/^[\t ]*/) || [""])[0] || "");
    const body = src.slice(indentOnly.length);
    const at = body.indexOf(s1);
    const atSecond = at >= 0 ? body.indexOf(s2, at + s1.length) : -1;
    seg = at < 0
      ? { indent: indentOnly, left: body, text: "", dates: "" }
      : {
        indent: indentOnly,
        left: body.slice(0, at).trim(),
        text: atSecond >= 0 ? body.slice(at + s1.length, atSecond).trim() : body.slice(at + s1.length).trim(),
        dates: atSecond >= 0 ? body.slice(atSecond + s2.length).trim() : "",
      };
  }
  const start = __sharedUtils.lineStartOf(String(seg.left || ""));
  const head = String(start.prefix || "");
  return {
    indent: String(seg.indent || ""),
    start: head,
    left: String(start.body || ""),
    text: String(seg.text || ""),
    dates: String(seg.dates || ""),
  };
}

function insertProcessedToken(line, token, panel, separators, shape, cfg) {
  const src = String(line || "");
  const processed = String(token || "").trim();
  if (!processed) return src;
  const tokenRx = new RegExp(`(^|\\s)${escapeRegexLiteral(processed)}(?=\\s|$)`);
  if (tokenRx.test(src)) return src;
  const indent = String((src.match(/^[\t ]*/) || [""])[0] || "");
  const body = src.slice(indent.length);
  const s1 = String(separators && separators.separator1 || "").trim();
  const s2 = String(separators && separators.separator2 || "").trim();
  if (!s1 || !s2) throw new Error("source processing separators are required");
  /*
   * Левый сегмент снят уборкой: единственный Separator — второй, правая часть
   * за ним (T4).
   */
  if (shape && shape.payloadFirst) {
    const parts = splitSourcePayload(src, separators, shape);
    if (parts.kind === "payload-right") {
      if (String(panel || "right").trim().toLowerCase() === "left") {
        const rest = [parts.payload, parts.s2, parts.right].filter((x) => String(x || "").length).join(" ");
        return `${parts.indent}${parts.prefix}${processed} ${parts.s1} ${rest}`.trimEnd();
      }
      const tail = parts.right ? `${parts.right} ${processed}` : processed;
      return `${parts.indent}${parts.prefix}${[parts.payload, parts.s2, tail].filter((x) => String(x || "").length).join(" ")}`;
    }
  }
  const first = body.indexOf(s1);
  const second = first >= 0 ? body.indexOf(s2, first + s1.length) : -1;
  if (String(panel || "right").trim().toLowerCase() === "left") {
    /*
     * Метка встаёт в зону значений, а не перед началом строки (2026-09-18): начало —
     * `lineStartOf` (У-184, правило 104), склейка зон — `joinLineParts` (за меткой
     * в левом Block идёт первый разделитель).
     */
    const zones = sourceLineZones(src, separators, cfg);
    /* Знак начала, значения и метка — через пробел: знак из дома без хвостового пробела. */
    const leftZone = [String(zones.start || "").trimEnd(), String(zones.left || "").trim(), processed]
      .filter((x) => String(x || "").length)
      .join(" ");
    return __linePipeline.joinLineParts({
      indent: zones.indent,
      left: leftZone,
      text: zones.text,
      dates: zones.dates,
    }, { sep1: s1, sep2: s2, hasLeftTokens: true }).trimEnd();
  }
  if (second >= 0) {
    const right = body.slice(second + s2.length).trim();
    return `${indent}${body.slice(0, second + s2.length).trimEnd()}${right ? " " + right : ""} ${processed}`;
  }
  return `${indent}${body.trimEnd()} ${s2} ${processed}`;
}

function resolveSourceCleanupFieldIds(i2n, cfg) {
  const selected = Array.isArray(i2n && i2n.sourceProcessing && i2n.sourceProcessing.cleanupFieldIds)
    ? i2n.sourceProcessing.cleanupFieldIds.map((x) => String(x || "").trim()).filter(Boolean)
    : [];
  const fields = getModeFields(cfg);
  const known = new Set(fields.map((f) => String(f && f.id || "").trim()).filter(Boolean));
  const kept = selected.filter((id) => known.has(id));
  /*
   * `Keep sub-fields` = `On`: у отмеченного Field остаются и дочерние Values
   * (дочерний идёт за родителем, В7). Оставленное из заметки не вычитается (В-228).
   */
  if (i2n && i2n.sourceProcessing && i2n.sourceProcessing.keepSubFields === true) {
    for (const id of kept.slice()) {
      const sub = __domainRegistry.inferSubFieldKey(id);
      if (known.has(sub) && kept.indexOf(sub) === -1) kept.push(sub);
    }
  }
  return kept;
}

/**
 * Уборка Values со строки и её новое устройство (какой слот исчез): заново строку
 * не разобрать (T4). `applySourceCleanupByFieldIds` — тонкая обёртка (У-32).
 */
function planSourceCleanup(line, transformContext, cleanupFieldIds, separators) {
  const src = String(line || "");
  const selected = new Set(Array.isArray(cleanupFieldIds) ? cleanupFieldIds : []);
  const rows = Array.isArray(transformContext && transformContext.matches) ? transformContext.matches : [];
  const spans = new Map();
  for (let i = 0; i < rows.length; i++) {
    const row = isObj(rows[i]) ? rows[i] : {};
    const fid = String(row.fieldId || "").trim();
    const span = isObj(row.span) ? row.span : null;
    if (!fid || !span || !Number.isInteger(span.start) || !Number.isInteger(span.end)) continue;
    const key = `${span.start}:${span.end}`;
    if (!spans.has(key)) spans.set(key, { start: span.start, end: span.end, owners: new Set() });
    spans.get(key).owners.add(fid);
  }
  const removable = Array.from(spans.values())
    .filter((span) => Array.from(span.owners).every((fid) => !selected.has(fid)))
    .sort((a, b) => b.start - a.start);
  let out = src;
  for (let i = 0; i < removable.length; i++) out = out.slice(0, removable[i].start) + out.slice(removable[i].end);
  const leadingIndent = String((out.match(/^\s*/) || [""])[0] || "");
  out = String(out.slice(leadingIndent.length) || "");
  const s1 = String(separators && separators.separator1 || "").trim();
  if (!s1) throw new Error("separator1 is required for source cleanup");
  out = out
    .replace(new RegExp(`\\s+${escapeRegexLiteral(s1)}\\s+`, "g"), ` ${s1} `)
    .replace(/\s{2,}/g, " ")
    .replace(/\s+$/g, "");
  /* Убрала ли уборка что-нибудь: только тогда снимается осиротевший Separator. */
  const sweptSomething = removable.length > 0;
  const plan = planSourceLineAfterCleanup(out, separators,
    transformContext && transformContext.singleIsSecond === true, sweptSomething);
  return { line: `${leadingIndent}${plan.line}`, payloadFirst: plan.payloadFirst };
}

function applySourceCleanupByFieldIds(line, transformContext, cleanupFieldIds, separators) {
  return planSourceCleanup(line, transformContext, cleanupFieldIds, separators).line;
}

function applySourcePrefixResolution(line, originalLine, transformContext, preservedFieldIds, cfg, lineFinalize) {
  const original = String(originalLine || "");
  /* Чекбокс — ровно один знак в скобках, как у Obsidian (правило 24): имя
     `[Trip plan]` читалось чекбоксом и удваивалось на строке (BUGHUNT 2026-09-30, C1). */
  const prefixMatch = original.match(/^([\t ]*)([-*+]\s+)(?:\[(.)\]\s+)?/);
  if (!prefixMatch) return String(line || "");
  if (!lineFinalize || typeof lineFinalize.buildPrefixUnified !== "function") {
    throw new Error("shared prefix resolver unavailable");
  }
  const pkm = isObj(cfg && cfg.pkm) ? cfg.pkm : {};
  /*
   * Правила приставок — у общего сборщика `pkm_rules_shape`, а не у ветки
   * `pkm.prefixRules` (форма версии 1, панель её не пишет; пути
   * `pkm.prefixPriority.*`). Измерено 2026-09-19 на его `data.json`.
   */
  /*
   * Условие прежнее: нет ветки — нет разбора приставки. Шире не править — это
   * изменило бы поведение без запроса (У-164).
   */
  if (!isObj(pkm.prefixRules)) return String(line || "");
  let prefixRules = pkm.prefixRules;
  try {
    const shaped = getRulesShapeModule().buildRulesForEngines(cfg);
    const shapedRules = isObj(shaped && shaped.behavior) ? shaped.behavior.prefixRules : null;
    if (isObj(shapedRules)) prefixRules = shapedRules;
  } catch (_) {
    /* Правила не собрались на полуготовом конфиге — приставка прежним источником. */
  }
  const behavior = { prefixRules, order: pkm.fields && pkm.fields.order };
  const orderTypes = isObj(behavior.order && behavior.order.types) ? behavior.order.types : {};
  const fields = getModeFields(cfg);
  const fieldsById = {};
  for (let i = 0; i < fields.length; i++) {
    const fid = String(fields[i] && fields[i].id || "").trim();
    if (fid) fieldsById[fid] = fields[i];
  }
  const preserved = new Set(Array.isArray(preservedFieldIds) ? preservedFieldIds : []);
  const selected = {};
  const matches = Array.isArray(transformContext && transformContext.matches) ? transformContext.matches : [];
  for (let i = 0; i < matches.length; i++) {
    const row = matches[i];
    const fid = String(row && row.fieldId || "").trim();
    if (!fid || !preserved.has(fid)) continue;
    const field = fieldsById[fid];
    const values = Array.isArray(field && field.values) ? field.values : [];
    const rawToken = String(row && row.rawToken || "").trim();
    for (let vi = 0; vi < values.length; vi++) {
      const value = values[vi];
      const valueToken = String(value && value.token || "").trim();
      if (!valueToken) continue;
      const fullToken = resolveEffectiveFieldType(field, orderTypes, fid) === "wikilink"
        ? `[[${valueToken.replace(/^#/, "")}]]`
        : composeFieldValueToken(field, valueToken);
      if (fullToken !== rawToken) continue;
      selected[fid] = String(value && value.id || valueToken);
      break;
    }
  }
  const rules = {
    leftMode: { fields },
    behavior: { prefixRules: isObj(behavior.prefixRules) ? behavior.prefixRules : {} },
  };
  const parsedLine = {
    bulletToken: String(prefixMatch[2] || "-").trim(),
    checkboxToken: prefixMatch[3] !== undefined ? `[${String(prefixMatch[3] || "")}]` : "",
    headingToken: "",
  };
  const resolved = String(lineFinalize.buildPrefixUnified(parsedLine, rules, { selected }, {
    isObj,
    getFieldById: (mode, fieldId) => {
      const sourceFields = Array.isArray(mode && mode.fields) ? mode.fields : [];
      return sourceFields.find((field) => String(field && field.id || "") === String(fieldId || "")) || null;
    },
  }) || "").trim();
  /*
   * Чекбокс человека остаётся (`В-239`, BUGHUNT T3): уходит только тот, что
   * стоит Prefix у Value этой строки (`checkboxByFieldValue`).
   */
  const byFieldValue = isObj(prefixRules && prefixRules.checkboxByFieldValue) ? prefixRules.checkboxByFieldValue : {};
  const own = new Set();
  for (let i = 0; i < matches.length; i++) {
    const map = byFieldValue[String(matches[i] && matches[i].fieldId || "").trim()];
    if (!isObj(map)) continue;
    /* Ключ Value в карте бывает и с решёткой, и без неё. */
    const raw = String(matches[i].rawToken || "").trim();
    for (const key of [raw, raw.replace(/^#/, "")]) if (map[key] != null) own.add(String(map[key]).trim());
  }
  const humanBox = parsedLine.checkboxToken && !own.has(parsedLine.checkboxToken) ? parsedLine.checkboxToken : "";
  const withBox = humanBox && !/\[[^\]]\]$/.test(resolved) ? `${resolved} ${humanBox}` : resolved;
  const indent = String((String(line || "").match(/^[\t ]*/) || [""])[0] || "");
  const body = String(line || "").slice(indent.length).replace(/^[-*+]\s+(?:\[[^\]]\]\s+)?/, "").trimStart();
  return `${indent}${withBox}${body ? " " + body : ""}`.trimEnd();
}

function composeFieldValueToken(field, valueToken) {
  const prefix = String(field && field.prefix || "#");
  const token = String(valueToken || "").trim();
  if (!token) return "";
  if (token.startsWith("#") || token.startsWith("[[")) return token;
  return `${prefix}${token}`;
}

function normalizePreviewSeparators(line, separators) {
  const src = String(line || "").trim();
  if (!src) return src;
  const s1 = String(separators && separators.separator1 || "").trim();
  const s2 = String(separators && separators.separator2 || "").trim();
  if (!s1 || !s2) return src;
  const parts = src.split(s1).map((x) => String(x || "").trim());
  if (parts.length < 3) return src.replace(/\s{2,}/g, " ").trim();
  const left = parts[0] || "";
  const payload = parts[1] || "";
  const right = parts.slice(2).join(` ${s2} `).trim();
  if (left && payload && right) return `${left} ${s1} ${payload} ${s2} ${right}`;
  if (left && payload) return `${left} ${s1} ${payload}`;
  if (payload && right) return `${payload} ${s2} ${right}`;
  if (left && right) return `${left} ${s2} ${right}`;
  return [left, payload, right].filter(Boolean).join(" ").replace(/\s{2,}/g, " ").trim();
}

/**
 * Строка после уборки и ответ «где теперь текст». `payloadFirst` — только
 * когда левый сегмент пуст: оставшийся Separator второй. Голый `- ` пустым
 * слотом не считается (`dropPrefix` снимает только чекбокс; T4).
 */
function planSourceLineAfterCleanup(line, separators, singleIsSecond, sweptSomething) {
  const src = String(line || "").trim();
  const plain = (value) => ({ line: value, payloadFirst: false });
  if (!src) return plain(src);
  const s1 = String(separators && separators.separator1 || "").trim();
  const s2 = String(separators && separators.separator2 || "").trim();
  if (!s1 || !s2) return plain(src);
  const parts = src.split(s1).map((x) => String(x || "").trim());
  /*
   * Один разделитель, и дом сказал, что он второй: слово человека перед ним —
   * устройство `payload`, потом правая часть (G2).
   */
  if (parts.length === 2 && singleIsSecond === true) {
    return { line: src.replace(/\s{2,}/g, " ").trim(), payloadFirst: true };
  }
  /*
   * Разделитель, которому нечего разделять, уходит (2026-09-20: `- #work [[test2]] :: 12`
   * → `- [[222/12]] :: #processed`): левый Block убран, правого нет. Есть правый
   * Block — Separator остаётся. Пустой левый Block самого человека сюда не
   * приходит: план зовут, только когда уборка что-то сняла.
   */
  if (parts.length === 2 && sweptSomething === true) {
    const marker = String((parts[0].match(/^[-*+]\s*(?:\[.\]\s*)?/u) || [""])[0] || "");
    const headLeft = String(parts[0] || "").slice(marker.length).trim();
    const tail = String(parts[1] || "").trim();
    if (!headLeft && tail) {
      const keptMarker = marker ? marker.trimEnd() + " " : "";
      return plain(`${keptMarker}${tail}`.replace(/\s{2,}/g, " ").trim());
    }
  }
  if (parts.length < 3) return plain(src.replace(/\s{2,}/g, " ").trim());
  const left = parts[0] || "";
  const payload = parts[1] || "";
  const right = parts.slice(2).join(` ${s2} `).trim();

  const dropPrefix = (s) => String(s || "").replace(/^[-*]\s*\[.\]\s*/u, "").trim();
  const leftNoPrefix = dropPrefix(left);

  if (!leftNoPrefix && !right && payload) return plain(`- ${payload}`.replace(/\s{2,}/g, " ").trim());
  if (leftNoPrefix && payload && right) return plain(`${left} ${s1} ${payload} ${s2} ${right}`);
  if (leftNoPrefix && payload) return plain(`${left} ${s1} ${payload}`);
  if (payload && right) return { line: `${payload} ${s2} ${right}`, payloadFirst: true };
  if (leftNoPrefix && right) return plain(`${left} ${s2} ${right}`);
  if (payload) return plain(`- ${payload}`);
  return plain([leftNoPrefix, right].filter(Boolean).join(" ").replace(/\s{2,}/g, " ").trim());
}

function normalizeSourceLineAfterCleanup(line, separators) {
  return planSourceLineAfterCleanup(line, separators).line;
}

function getActiveOrderedFieldIds(cfg) {
  const behavior = isObj(cfg && cfg.pkm && cfg.pkm.fields) ? cfg.pkm.fields : {};
  const order = isObj(behavior.order) ? behavior.order : {};
  const left = Array.isArray(order.left) ? order.left.slice() : [];
  const right = Array.isArray(order.right) ? order.right.slice() : [];
  const baseOrdered = left.concat(right).map((x) => String(x || "").trim()).filter(Boolean);
  const active = isObj(order.active) ? order.active : {};
  const enabled = isObj(order.enabled) ? order.enabled : {};
  const fields = getModeFields(cfg);
  const allIds = fields.map((f) => String(f && f.id || "").trim()).filter(Boolean);
  const childrenByParent = {};
  for (let i = 0; i < fields.length; i++) {
    const fid = String(fields[i] && fields[i].id || "").trim();
    const parentId = String(fields[i] && fields[i].dependsOn || "").trim();
    if (!fid || !parentId) continue;
    if (!Array.isArray(childrenByParent[parentId])) childrenByParent[parentId] = [];
    childrenByParent[parentId].push(fid);
  }
  const out = [];
  const pushIfActive = (fid) => {
    if (!fid || out.includes(fid)) return;
    if (String(active[fid] || "").trim().toLowerCase() === "no") return;
    if (Object.prototype.hasOwnProperty.call(enabled, fid) && enabled[fid] === false) return;
    out.push(fid);
    const children = Array.isArray(childrenByParent[fid]) ? childrenByParent[fid] : [];
    for (let i = 0; i < children.length; i++) pushIfActive(children[i]);
  };
  for (let i = 0; i < baseOrdered.length; i++) {
    pushIfActive(baseOrdered[i]);
  }
  for (let i = 0; i < allIds.length; i++) pushIfActive(allIds[i]);
  return out;
}

function sampleValueForField(field, fType, elementFormat) {
  if (fType === "element") {
    const marker = resolveFieldMarker(field);
    if (!marker) return "";
    /* Пример значения — законный для формата поля: слово `value` разборщик не узнаёт. */
    const sample = elementSampleValueFromFormat(elementFormat || (field && field.format));
    return sample ? `${marker}${sample}` : `${marker}value`;
  }
  if (fType === "wikilink") {
    const wl = fieldWikilinkCandidates(field);
    if (wl.length) return `[[${wl[0].token}]]`;
    return "[[Link]]";
  }
  const tags = fieldTokenCandidates(field);
  if (tags.length) return tags[0].fullToken;
  return "";
}

/**
 * Текст выдуманной строки предпросмотров и её префикс-буллит с чекбоксом —
 * чтобы было видно, что происходит с началом строки (B13).
 */
/*
 * Текст выдуманной строки длиннее названия: иначе всё уходило в название, и
 * `Words to keep` в предпросмотре ничего не менял (T1).
 */
const PREVIEW_TEXT_WORDS = "buy milk and bread on the way home after work today";
const PREVIEW_LINE_PREFIX = "- [ ] ";

function buildPreviewBaseLine(cfg) {
  const separators = resolveIoSeparators(cfg);
  const behavior = isObj(cfg && cfg.pkm && cfg.pkm.fields) ? cfg.pkm.fields : {};
  const order = isObj(behavior.order) ? behavior.order : {};
  const orderTypes = isObj(order.types) ? order.types : {};
  const fields = getModeFields(cfg);
  const byId = {};
  for (let i = 0; i < fields.length; i++) {
    const fid = String(fields[i] && fields[i].id || "").trim();
    if (fid) byId[fid] = fields[i];
  }
  const elements = isObj(behavior.elements) ? behavior.elements : {};
  const elementsByField = isObj(elements.byField) ? elements.byField : {};
  const orderedActive = getActiveOrderedFieldIds(cfg);
  const leftOrder = new Set((Array.isArray(order.left) ? order.left : []).map((x) => String(x || "").trim()));
  const rightOrder = new Set((Array.isArray(order.right) ? order.right : []).map((x) => String(x || "").trim()));
  const leftTokens = [];
  const rightTokens = [];
  for (let i = 0; i < orderedActive.length; i++) {
    const fid = orderedActive[i];
    const field = byId[fid];
    if (!field) continue;
    const type = resolveEffectiveFieldType(field, orderTypes, fid);
    const token = sampleValueForField(field, type,
      isObj(elementsByField[fid]) ? elementsByField[fid].format : "");
    if (!token) continue;
    const composed = `${token}`;
    const parentId = String(field && field.dependsOn || "").trim();
    if (rightOrder.has(fid) || parentId && rightOrder.has(parentId)) rightTokens.push(composed);
    else if (leftOrder.has(fid) || parentId && leftOrder.has(parentId)) leftTokens.push(composed);
    else leftTokens.push(composed);
  }
  const left = leftTokens.join(" ").trim();
  const right = rightTokens.join(" ").trim();
  /* Несколько слов, а не одно: иначе не видно работы `Words to keep` (B18). */
  const text = PREVIEW_TEXT_WORDS;
  const p = PREVIEW_LINE_PREFIX;
  if (left && right) return `${p}${left} ${separators.separator1} ${text} ${separators.separator2} ${right}`;
  if (left) return `${p}${left} ${separators.separator1} ${text}`;
  if (right) return `${p}${text} ${separators.separator2} ${right}`;
  return p + text;
}

/**
 * Дерево «до и после» для предпросмотра `Source line` (10.13.10) — тем же путём,
 * что настоящий перенос (У-4). Судьбу детей решает `Sub-lines (tree) behavior`:
 * `stay` — остаются, `remove` — уходят в заметку.
 */
function buildSourcePreviewTree(i2n, cfg) {
  const base = buildPreviewBaseLine(cfg);
  if (!base) return { before: [], after: [] };
  const separators = resolveIoSeparators(cfg);
  /*
   * Fields нет — показывать нечего; признак — Separator, он появляется только с
   * первым Field.
   */
  if (!base.includes(separators.separator1) && !base.includes(separators.separator2)) {
    return { before: [], after: [] };
  }
  const indent = "\t";
  /* У ребёнка свой текст, чтобы видеть, какая строка куда уехала. */
  const childOf = (n) => indent + base.replace(PREVIEW_TEXT_WORDS, "sub-line " + n + " of the same list");
  const children = [childOf(1), childOf(2)];
  const parentAfter = buildSourcePreviewLine(i2n, cfg).after;
  const sublines = String(i2n && i2n.sublines || "").trim().toLowerCase() === "remove" ? "remove" : "stay";
  return {
    before: [base].concat(children),
    after: sublines === "remove" ? [parentAfter] : [parentAfter].concat(children),
    sublines,
  };
}

function buildSourcePreviewLine(i2n, cfg) {
  const before = buildPreviewBaseLine(cfg);
  if (!before) return { before: "", after: "" };
  const separators = resolveIoSeparators(cfg);
  const parsed = parseInlineLine(before, cfg);
  const ctx = buildTransformContext(parsed, cfg);
  /* Название — тем же `resolveTitleSwap`, что у движка (У-32). */
  const titleSwap = resolveTitleSwap(parsed, i2n, null);
  const processed = composeSourceRoot(before, ctx, cfg, separators, {
    i2n, noteTitle: "Preview", explicitTitle: titleSwap.explicitTitle, titleWords: titleSwap.titleWords,
  });
  const after = normalizePreviewSeparators(normalizeSourceLineAfterCleanup(processed, separators), separators);
  return { before, after };
}

/**
 * Исходная строка после переноса — одна дорога на команду и предпросмотр
 * `Source line` (BUGHUNT 2026-09-30, C13; `В-239`, правило 72). Шаги: уборка
 * Fields, приставка, судьба текста со ссылкой, метка, знак заголовка — последним (`В-129`).
 */
function composeSourceRoot(sourceLine, transformContext, cfg, separators, opts) {
  const o = isObj(opts) ? opts : {};
  const i2n = isObj(o.i2n) ? o.i2n : {};
  const sp = isObj(i2n.sourceProcessing) ? i2n.sourceProcessing : {};
  const cleanupFieldIds = resolveSourceCleanupFieldIds(i2n, cfg);
  /* Устройство строки после уборки решается один раз и едет с ней (T4). */
  const cleanupPlan = planSourceCleanup(sourceLine, transformContext, cleanupFieldIds, separators);
  const shape = { payloadFirst: cleanupPlan.payloadFirst };
  let line = applySourcePrefixResolution(cleanupPlan.line, sourceLine, transformContext, cleanupFieldIds, cfg, o.lineFinalize || __lineFinalize);
  /* Ссылка и судьба текста решаются вместе, одной записью строки. */
  line = applySourceTextFate(line, o.noteTitle, separators, {
    text: sp.text,
    keepWords: sp.keepWords,
    link: !!sp.replaceWithLink,
    explicitTitle: o.explicitTitle,
    titleWords: o.titleWords,
    i2n,
    shape,
  });
  line = insertProcessedToken(line, sp.token, sp.panel, separators, shape, cfg);
  /* Знак заголовка → знак списка последним (В-129). */
  return headingSourceBecomesBullet(line, sourceLine);
}


function indentSize(line) {
  const s = String(line || "");
  const m = s.match(/^[\t ]*/);
  const raw = m ? String(m[0] || "") : "";
  let n = 0;
  for (let i = 0; i < raw.length; i++) n += raw[i] === "\t" ? 2 : 1;
  return n;
}

/**
 * Уровень заголовка; ноль — не заголовок. Признак — у `lineStartOf` (цитата,
 * каллаут; У-32).
 */
function headingLevelOf(line) {
  const heading = String(__sharedUtils.lineStartOf(String(line || "")).heading || "").trim();
  return heading ? heading.length : 0;
}

/**
 * Где кончается то, что относится к строке, — одно объявление для курсора и
 * выделения. Своё — записанное с отступом; у заголовка — весь раздел до
 * заголовка того же или старшего уровня (В-129).
 */
function blockEndFor(ed, rootLine, fromLine, total) {
  const level = headingLevelOf(rootLine);
  const baseIndent = indentSize(rootLine);
  let end = fromLine;
  for (let i = fromLine + 1; i < total; i++) {
    const cur = String(ed.getLine(i) || "");
    if (!cur.trim()) { end = i; continue; }
    if (level) {
      const curLevel = headingLevelOf(cur);
      if (curLevel && curLevel <= level) break;
      end = i;
      continue;
    }
    if (indentSize(cur) > baseIndent) { end = i; continue; }
    break;
  }
  return end;
}

/**
 * Строка-заголовок после переноса становится строкой списка (В-129): раздел
 * уехал в заметку. Меняется только знак начала, отступ/цитата/каллаут остаются
 * (У-184); знак — `"- "`, как в других местах плагина.
 */
function headingSourceBecomesBullet(nextLine, sourceLine) {
  if (!headingLevelOf(sourceLine)) return nextLine;
  const start = __sharedUtils.lineStartOf(String(nextLine || ""));
  if (!start.heading) return nextLine;
  return `${start.indent}${start.quote}${start.callout}- ${start.body}`;
}

function deriveRootBlockFromEditor(ed, lineNo) {
  if (!ed || typeof ed.getLine !== "function") {
    return { rootIndex: 0, rootLine: "", blockStart: 0, blockEnd: 0, blockLines: [""], allLines: [""] };
  }
  const rootLine = String(ed.getLine(lineNo) || "");
  const total = typeof ed.lineCount === "function" ? Number(ed.lineCount() || 0) : (lineNo + 1);
  const end = blockEndFor(ed, rootLine, lineNo, total);
  const lines = [];
  for (let i = lineNo; i <= end; i++) lines.push(String(ed.getLine(i) || ""));
  return {
    rootIndex: 0,
    rootLine,
    blockStart: lineNo,
    blockEnd: end,
    blockLines: lines,
    allLines: lines.slice(),
    absolute: true,
  };
}

function deriveSelectionRangeFromEditor(ed, from, to) {
  if (!ed || typeof ed.getLine !== "function") throw new Error("editor line API unavailable");
  const total = typeof ed.lineCount === "function" ? Math.max(1, Number(ed.lineCount() || 1)) : Math.max(1, Number(to && to.line || 0) + 1);
  let start = Math.max(0, Math.min(total - 1, Number(from && from.line || 0)));
  let selectedEnd = Math.max(start, Math.min(total - 1, Number(to && to.line || start)));
  if (selectedEnd > start && Number(to && to.ch || 0) === 0) selectedEnd -= 1;
  while (start <= selectedEnd && !String(ed.getLine(start) || "").trim()) start += 1;
  if (start > selectedEnd) throw new Error("selection contains no transformable line");
  const rootLine = String(ed.getLine(start) || "");
  /* Хвост за выделением — тем же правилом, что блок под курсором (У-32, В-129). */
  const end = blockEndFor(ed, rootLine, selectedEnd, total);
  const blockLines = [];
  for (let i = start; i <= end; i++) blockLines.push(String(ed.getLine(i) || ""));
  return {
    rootIndex: 0,
    rootLine,
    blockStart: start,
    blockEnd: end,
    blockLines,
    blockText: blockLines.join("\n"),
    absolute: true,
    partialSelectionExpanded: Number(from && from.ch || 0) > 0 || Number(to && to.ch || 0) < String(ed.getLine(Number(to && to.line || 0)) || "").length,
  };
}

function readEditorBlock(ed, info) {
  const lines = [];
  for (let i = Number(info.blockStart || 0); i <= Number(info.blockEnd || 0); i++) lines.push(String(ed.getLine(i) || ""));
  return lines.join("\n");
}

function assertEditorSnapshot(plugin, ed, info, expectedBlock) {
  if (!ed || plugin && typeof plugin.getActiveEditor === "function" && plugin.getActiveEditor() !== ed) {
    throw new Error("source editor changed before transform completed");
  }
  if (readEditorBlock(ed, info) !== String(expectedBlock || "")) {
    throw new Error("source changed before transform completed");
  }
}

/**
 * Курсор после `Inline to note` — в конец текста (2026-09-18): строка
 * переписывается от нулевого столбца, и платформа оставила бы каретку в начале.
 * Конец текста — у дома зон (`splitSegments`, У-153). Текста нет — курсор не трогаем.
 */
function sourceTextCursorCh(line, separators, cfg) {
  const src = String(line || "");
  const zones = sourceLineZones(src, separators, cfg);
  const text = String(zones.text || "").trim();
  if (!text) return -1;
  const s1 = String(separators && separators.separator1 || "").trim();
  const leftBody = String(zones.left || "").trim();
  /* Текст ищется за зоной значений: то же слово может стоять в ней. */
  let from = String(zones.indent || "").length + String(zones.start || "").length;
  if (leftBody && s1) {
    const sepAt = src.indexOf(s1, from);
    if (sepAt >= 0) from = sepAt + s1.length;
  }
  const at = src.indexOf(text, from);
  if (at < 0) return -1;
  return at + text.length;
}

function replaceEditorSourceBlock(ed, info, nextRootLine, sublines, separators, cfg) {
  if (!ed || typeof ed.replaceRange !== "function") throw new Error("editor replace API unavailable");
  const start = Number(info.blockStart || 0);
  const end = Number(info.blockEnd || start);
  /* Курсор — после записи: до неё столбец относится к прежней строке. */
  const putCursor = () => {
    const ch = sourceTextCursorCh(nextRootLine, separators, cfg);
    if (ch < 0) return;
    if (typeof ed.setCursor !== "function") throw new Error("editor cursor API unavailable");
    ed.setCursor({ line: start, ch });
  };
  if (String(sublines || "stay").trim().toLowerCase() !== "remove") {
    const oldRoot = String(ed.getLine(start) || "");
    ed.replaceRange(String(nextRootLine || ""), { line: start, ch: 0 }, { line: start, ch: oldRoot.length });
    putCursor();
    return;
  }
  const total = typeof ed.lineCount === "function" ? Number(ed.lineCount() || 0) : end + 1;
  if (end + 1 < total) {
    ed.replaceRange(`${String(nextRootLine || "")}\n`, { line: start, ch: 0 }, { line: end + 1, ch: 0 });
    putCursor();
    return;
  }
  const endText = String(ed.getLine(end) || "");
  ed.replaceRange(String(nextRootLine || ""), { line: start, ch: 0 }, { line: end, ch: endText.length });
  putCursor();
}

/**
 * Переменные шаблона (`В-245`; BUGHUNT T15): `{{title}}`, `{{date}}`, `{{time}}`,
 * `{{date:ФОРМАТ}}`/`{{time:ФОРМАТ}}` — как у плагина Templates Obsidian;
 * умолчания `YYYY-MM-DD` и `HH:mm`.
 */
function fillTemplateVariables(text, title, now) {
  /* Дату пишет тот же форматировщик, что пишет значения дат в строку. */
  const d = now instanceof Date ? now : new Date();
  const at = { format: (fmt) => __sharedUtils.formatDateByMask(d, fmt) };
  return String(text || "")
    .replace(/{{\s*title\s*}}/gi, () => String(title || ""))
    .replace(/{{\s*date(?::([^}]*))?\s*}}/gi, (_m, fmt) => at.format(String(fmt || "").trim() || "YYYY-MM-DD"))
    .replace(/{{\s*time(?::([^}]*))?\s*}}/gi, (_m, fmt) => at.format(String(fmt || "").trim() || "HH:mm"));
}

async function readTemplateContent(plugin, templatePath) {
  const path = String(templatePath || "").trim();
  if (!path) return "";
  if (!plugin || !plugin.app || !plugin.app.vault) throw new Error("vault unavailable for template read");
  const af = plugin.app.vault.getAbstractFileByPath(path);
  if (!af) throw new Error(`template not found: ${path}`);
  try {
    return await plugin.app.vault.read(af);
  } catch (error) {
    throw new Error(`failed to read template ${path}: ${error && error.message ? error.message : error}`);
  }
}

/**
 * `Type name of header` → уровень и текст (З-4). `null` — имя не задано,
 * `At custom header` равен запасному.
 */
function parseTargetHeaderSpec(raw) {
  const parts = splitLeadingHashes(raw);
  const text = String(parts.text || "").trim();
  if (!text) return null;
  return { level: Number(parts.level) || 0, text };
}

/** Заголовок в строке: уровень и текст. `null` — строка не заголовок. */
function readHeadingLine(line) {
  const m = String(line || "").match(/^(#{1,6})[ \t]+(.*)$/);
  if (!m) return null;
  return { level: String(m[1]).length, text: String(m[2] || "").trim() };
}

/**
 * Номер строки, ПЕРЕД которой ложится блок (конец секции заголовка); `-1` —
 * заголовка нет. Одноимённые — первый; регистр не важен; уровень важен, только
 * если написан (`## Log` vs `Log`). Пустые строки в конце секции — до блока.
 */
function findCustomHeaderLine(lines, spec) {
  if (!spec) return -1;
  const wanted = String(spec.text || "").toLowerCase();
  for (let i = 0; i < lines.length; i++) {
    const h = readHeadingLine(lines[i]);
    if (!h) continue;
    if (spec.level && h.level !== spec.level) continue;
    if (h.text.toLowerCase() !== wanted) continue;
    return i;
  }
  return -1;
}

function findCustomHeaderInsertAt(lines, spec) {
  const at = findCustomHeaderLine(lines, spec);
  if (at === -1) return -1;
  const own = readHeadingLine(lines[at]).level;
  let end = lines.length;
  for (let i = at + 1; i < lines.length; i++) {
    const h = readHeadingLine(lines[i]);
    if (h && h.level <= own) { end = i; break; }
  }
  while (end > at + 1 && !String(lines[end - 1] || "").trim()) end--;
  return end;
}

/**
 * Тело заметки с блоком (З-4) — одна функция для новой заметки и дописывания
 * (У-32). `null` — заголовок не найден, запасное выбирает вызывающий.
 */
function placeBlockUnderHeader(baseBody, block, spec, nl, spaced = true, headed = false) {
  const lines = String(baseBody || "").replace(/\r?\n/g, nl).split(nl);
  const at = findCustomHeaderInsertAt(lines, spec);
  if (at === -1) return null;
  const head = lines.slice(0, at);
  const tail = lines.slice(at);
  const section = readHeadingLine(lines[findCustomHeaderLine(lines, spec)]).level;
  const blockLines = String(headed ? entryUnderSection(block, section, nl) : block || "").split(nl);
  const out = head.slice();
  /*
   * Пустая строка с обеих сторон, как у `At the end`: иначе Obsidian склеит
   * заголовок с чужим абзацем.
   */
  if (spaced && out.length && String(out[out.length - 1] || "").trim()) out.push("");
  for (const line of blockLines) out.push(line);
  if (spaced && tail.length && String(tail[0] || "").trim()) out.push("");
  for (const line of tail) out.push(line);
  return out.join(nl);
}

/**
 * Заголовок, заводимый самим, когда названного нет (S4, 2026-09-08). Уровень —
 * из имени (`## Log` → второй), иначе следующий запуск его не найдёт; без
 * решёток — первый (плейсхолдер `# Header name`). Имени нет — заводить нечего.
 */
function headerLineForSpec(spec) {
  if (!spec) return "";
  const text = String(spec.text || "").trim();
  if (!text) return "";
  const level = Math.max(1, Math.min(6, Number(spec.level) || 1));
  return `${"#".repeat(level)} ${text}`;
}

/**
 * Блок с заведённым для него заголовком (S4) — одно объявление на оба пути (У-32).
 */
function blockWithOwnHeader(block, spec, nl, headed = false) {
  const body = String(block || "");
  const header = headerLineForSpec(spec);
  if (!header) return body;
  const entry = headed ? entryUnderSection(body, readHeadingLine(header).level, nl) : body;
  return `${header}${nl}${entry}`;
}

/**
 * Заголовок записи — на уровень ниже раздела (`В-254`): запись уровня `## Log`
 * закрывала бы раздел, и записи шли бы в обратном порядке (BUGHUNT 2026-09-30,
 * C2). Трогается только заголовок плагина (`headed`); глубже шестого — шестой.
 */
function entryUnderSection(block, sectionLevel, nl) {
  const lines = String(block || "").split(nl);
  const h = readHeadingLine(lines[0]);
  if (!h || h.level > sectionLevel || sectionLevel >= 6) return String(block || "");
  lines[0] = `${"#".repeat(sectionLevel + 1)} ${h.text}`;
  return lines.join(nl);
}

/*
 * Строка над дописанным текстом — из `Line above the text` (BUGHUNT T14).
 */
function composeAppendBlock(inlineText, i2n) {
  const header = formatHeaderByMode(i2n);
  return [header, normalizeInlineBlockForBody(inlineText, "\n")].filter(Boolean).join("\n");
}

function normalizeInlineBlockForBody(inlineLine, newline) {
  const nl = newline === "\r\n" ? "\r\n" : "\n";
  const lines = String(inlineLine || "").split(/\r?\n/);
  while (lines.length && !String(lines[0] || "").trim()) lines.shift();
  while (lines.length && !String(lines[lines.length - 1] || "").trim()) lines.pop();
  if (!lines.length) return "";
  const rootIndent = String((String(lines[0] || "").match(/^[\t ]*/) || [""])[0] || "");
  if (rootIndent) {
    for (let i = 0; i < lines.length; i++) {
      if (String(lines[i] || "").startsWith(rootIndent)) lines[i] = String(lines[i]).slice(rootIndent.length);
    }
  }
  return lines.join(nl);
}

function composeBodyWithPlacement(templateBody, inlineLine, i2n, newline) {
  const base = String(templateBody || "");
  const nl = newline === "\r\n" ? "\r\n" : "\n";
  const source = normalizeInlineBlockForBody(inlineLine, nl);
  const header = formatHeaderByMode(i2n);
  const block = [header, source].filter(Boolean).join(nl);
  const placement = isObj(i2n && i2n.placement) ? i2n.placement : {};
  const pos = String(placement.position || "end").trim().toLowerCase();
  /* Ровно одна пустая строка между частями и `\n` в конце файла, сколько бы
     переводов ни стояло на краях шаблона (BUGHUNT 2026-09-30, C19). */
  const apart = (first, second) => {
    const out = String(first).replace(/\r?\n/g, nl).replace(/(?:\r?\n)+$/, "")
      + nl + nl + String(second).replace(/\r?\n/g, nl).replace(/^(?:\r?\n)+/, "");
    return out.endsWith(nl) ? out : out + nl;
  };
  /*
   * `At custom header` (З-4): блок — в конец секции заголовка; нет заголовка —
   * заводится сам, запасное положение говорит где (S4). Ветка до проверки на
   * пустое тело нарочно: у новой заметки без шаблона это самый частый случай.
   */
  if (pos === "custom-header") {
    const spec = parseTargetHeaderSpec(placement.targetHeader);
    const headed = /^#/.test(header);
    const placed = placeBlockUnderHeader(base, block, spec, nl, true, headed);
    if (placed !== null) return placed;
    const own = blockWithOwnHeader(block, spec, nl, headed);
    if (!base.trim()) return own + nl;
    const fallback = String(placement.fallback || "end").trim().toLowerCase();
    if (fallback === "beginning") return apart(own, base);
    return apart(base, own);
  }
  if (!base.trim()) return block + nl;
  if (pos === "beginning") return apart(block, base);
  return apart(base, block);
}

/**
 * Дописывание в существующую заметку (`Add to the existing one`): начало/конец
 * как прежде, плюс `At custom header`. Frontmatter отрезается до поиска: решётки
 * в YAML — не заголовки.
 */
function appendBlockIntoNote(previous, block, i2n, nl) {
  const before = String(previous == null ? "" : previous);
  const text = String(block || "").trim().replace(/\r?\n/g, nl);
  if (!text) return before;
  /* Пустая заметка получает блок с первой строки (`В-244`). */
  if (!before.trim()) return text + nl;
  /* Пустая строка между записью и соседями; `emptyLine: false` у ссылок в чужих
     заметках её снимает (`Add empty line before wikilink`, 2026-09-28). */
  const spaced = !(isObj(i2n) && i2n.emptyLine === false);
  const gap = spaced ? nl + nl : nl;
  const placement = isObj(i2n && i2n.placement) ? i2n.placement : {};
  const pos = String(placement.position || "end").trim().toLowerCase();
  /* `At the beginning` — за frontmatter, в начало тела (BUGHUNT T14). */
  if (pos === "beginning") {
    const fm = parseFrontmatter(before);
    const top = before.slice(0, before.length - fm.body.length);
    const rest = fm.body.replace(/^(?:\r?\n)+/, "").replace(/\r?\n/g, nl);
    return rest.trim() ? `${top}${text}${gap}${rest}` : `${top}${text}${nl}`;
  }
  if (pos !== "custom-header") return `${before.trimEnd()}${gap}${text}${nl}`;

  const parsed = parseFrontmatter(before);
  const head = before.slice(0, before.length - parsed.body.length);
  const spec = parseTargetHeaderSpec(placement.targetHeader);
  /* Первая строка блока — наш заголовок, только если его ставит `Line above
     the text` (`В-254`). */
  const headed = /^#/.test(formatHeaderByMode(i2n));
  const placed = placeBlockUnderHeader(parsed.body, text, spec, nl, spaced, headed);
  if (placed !== null) return `${head}${placed}`;
  /* Заголовка нет — заводится тем же правилом, что у новой заметки (S4, У-32). */
  const own = blockWithOwnHeader(text, spec, nl, headed);
  const fallback = String(placement.fallback || "end").trim().toLowerCase();
  if (fallback === "beginning") {
    const body = parsed.body.replace(/\r?\n/g, nl);
    return body.trim() ? `${head}${own}${gap}${body}` : `${head}${own}${nl}`;
  }
  return `${before.trimEnd()}${gap}${own}${nl}`;
}

function pathWithNumericSuffix(basePath, index) {
  const src = String(basePath || "");
  const suffix = String(index).padStart(2, "0");
  return src.replace(/\.md$/i, `-${suffix}.md`);
}

async function writeInline2Note(plugin, target, content, appendBlock, i2n) {
  const vault = plugin.app.vault;
  let af = vault.getAbstractFileByPath(target.path);
  if (target.mode === "new_note") {
    let candidate = String(target.path || "");
    const basePath = String(target.basePath || target.path || "");
    for (let index = 0; index < 1000; index++) {
      if (index > 0) candidate = pathWithNumericSuffix(basePath, index);
      if (vault.getAbstractFileByPath(candidate)) continue;
      /* Папка пути — одно объявление на все три записи (У-32). */
      const folderPath = folderOfNotePath(candidate);
      if (folderPath && !vault.getAbstractFileByPath(folderPath)) await vault.createFolder(folderPath);
      try {
        await vault.create(candidate, content);
        const actualTarget = { ...target, path: candidate, exists: false };
        return {
          target: actualTarget,
          rollback: async () => {
            const created = vault.getAbstractFileByPath(candidate);
            if (created && typeof vault.delete === "function") await vault.delete(created);
            else if (created) throw new Error("vault.delete unavailable");
          },
        };
      } catch (error) {
        if (vault.getAbstractFileByPath(candidate)) continue;
        throw error;
      }
    }
    throw new Error(`unique note allocation exhausted for ${basePath}`);
  }
  if (!af) {
    const folderPath = folderOfNotePath(target.path);
    if (folderPath && !plugin.app.vault.getAbstractFileByPath(folderPath)) {
      await plugin.app.vault.createFolder(folderPath);
    }
    await vault.create(target.path, content);
    return {
      target: { ...target, exists: false },
      rollback: async () => {
        const created = vault.getAbstractFileByPath(target.path);
        if (created && typeof vault.delete === "function") await vault.delete(created);
        else if (created) throw new Error("vault.delete unavailable");
      },
    };
  }
  /*
   * Правка чужой заметки — через `Vault.process` (Р8, 2026-09-08): чтение и запись
   * одним ходом, без затирания правки человека; прежнее содержимое для отката
   * запоминается внутри хода. `minAppVersion` `1.13.0` — запасного `modify` нет (У-90).
   */
  if (target.mode === "overwrite") {
    let previous = "";
    await vault.process(af, (data) => {
      previous = String(data == null ? "" : data);
      return content;
    });
    return { target, rollback: async () => { await vault.process(af, () => previous); } };
  }
  if (target.mode === "add_to_note") {
    let previous = "";
    await vault.process(af, (data) => {
      previous = String(data == null ? "" : data);
      /* Перевод строки берётся у самой заметки: у человека может быть CRLF. */
      const nl = previous.includes("\r\n") ? "\r\n" : "\n";
      return appendBlockIntoNote(previous, appendBlock, i2n, nl);
    });
    return { target, rollback: async () => { await vault.process(af, () => previous); } };
  }
  throw new Error(`unsupported collision mode ${target.mode}`);
}


async function runInline2Note(plugin, runtimeOptions) {
  const cfg = plugin && typeof plugin.getConfig === "function" ? plugin.getConfig() : {};
  const separators = resolveIoSeparators(cfg);
  const i2n = normalizeInline2Note(cfg && cfg.transform ? cfg.transform.inline2note : null);
  /* Заметка со строкой — до того, как активной станет новая: от неё ссылки
     разрешаются, как при щелчке. */
  const activeFile = plugin && plugin.app && plugin.app.workspace && typeof plugin.app.workspace.getActiveFile === "function"
    ? plugin.app.workspace.getActiveFile() : null;
  const sourcePath = activeFile && typeof activeFile.path === "string" ? activeFile.path : "";
  if (!i2n.enabled) {
    /* Модуль включён, выключен сам `Inline to note` — сказать, где включить (BUGHUNT S17). */
    plugin.notice(__say(__noticeKey("transform", "inline-off"), "Inline to note is switched off: turn it on in the Transform tab of the settings"));
    return;
  }
  const ed = plugin.getActiveEditor();
  if (!ed) {
    plugin.notice(__say(__noticeKey("transform", "no-editor"), "Open a note first"));
    return;
  }
  const from = typeof ed.getCursor === "function" ? ed.getCursor("from") : null;
  const to = typeof ed.getCursor === "function" ? ed.getCursor("to") : null;
  const hasSelection = !!(ed && typeof ed.somethingSelected === "function" && ed.somethingSelected());
  if (!from || !to) throw new Error("editor cursor unavailable");
  const selectionInfo = hasSelection
    ? deriveSelectionRangeFromEditor(ed, from, to)
    : deriveRootBlockFromEditor(ed, Number(from.line || 0));
  const sourceLine = String(selectionInfo.rootLine || "");
  const sourceBlockText = String(selectionInfo.blockText || (selectionInfo.blockLines || []).join("\n") || sourceLine);
  const sourceSnapshot = readEditorBlock(ed, selectionInfo);
  /* Строка с меткой обработки уже стала заметкой — повтор не делается (BUGHUNT 2026-09-30, C4). */
  const processedToken = String(i2n.sourceProcessing && i2n.sourceProcessing.token || "").trim();
  if (processedToken && __editorVisualsConfig.lineHasProcessedToken(sourceLine, processedToken)) {
    plugin.notice(__say(__noticeKey("transform", "already-note"), "This line is already a note: its mark {0} says so", processedToken));
    return;
  }
  const parsed = parseInlineLine(sourceLine, cfg);
  if (!String(parsed.payloadText || "").trim()) throw new Error("source payload is empty");
  const transformContext = buildTransformContext(parsed, cfg);
  const resolvedTitle = await resolveNoteTitle(plugin, parsed, i2n, runtimeOptions);
  if (resolvedTitle === null) {
    plugin.notice(__say(__noticeKey("transform", "cancelled"), "Transform cancelled"));
    return;
  }
  const title = sanitizeResolvedTitle(resolvedTitle);
  if (!title) throw new Error("note title is empty");
  /*
   * Имя в скобках — название, а не текст (R4): снимается и с уезжающего, и с
   * остающегося. Только то, что и правда стало названием.
   */
  /*
   * Слова названия — тоже название, ссылка встаёт на их место (T1; заголовок —
   * `G2`). Один ответ — `resolveTitleSwap`.
   */
  const titleSwap = resolveTitleSwap(parsed, i2n, title);
  const explicitTitle = titleSwap.explicitTitle;
  const titleWords = titleSwap.titleWords;
  const noteBlockText = stripExplicitTitleFromBlock(sourceBlockText || sourceLine, explicitTitle, i2n);
  /* Правило выбирается один раз — шаблон и папка у него (10.13.8 Н5). */
  const smartRule = selectSmartRule(parsed, i2n.smartRules, cfg);
  const target = sameNoteAgain(plugin, parsed, sourceLine, sourcePath) || await pickTargetPath(plugin, title, i2n, smartRule);
  /* Типы свойств из хранилища: список остаётся списком и при одном значении (B21). */
  const yamlMap = buildYamlMapFromContext(transformContext, cfg, readVaultPropertyTypes(plugin && plugin.app));
  const templatePath = String(smartRule && smartRule.targetTemplate || "").trim()
    || String(i2n.defaultTemplate || "").trim();
  const templateContent = target.mode === "add_to_note" && target.exists
    ? ""
    /* `{{title}}` — имя заметки, как у шаблонов Obsidian (BUGHUNT 2026-09-30, C18). */
    : fillTemplateVariables(await readTemplateContent(plugin, templatePath),
      deriveSourceWikilinkFromTargetPath(target.path).split("/").pop() || title);
  const { yamlLines, body, newline } = parseFrontmatter(templateContent);
  const mergedYaml = renderYamlBlockWithOrder(yamlLines, yamlMap, cfg);
  /* Чей `placement` — общий или правила (З-5): спрашивается один раз (У-32). */
  const placementSource = resolvePlacementSource(i2n, smartRule);
  const bodyOut = composeBodyWithPlacement(body, noteBlockText, placementSource, newline);
  const yamlBlock = mergedYaml.length ? `---${newline}${mergedYaml.join(newline)}${newline}---${newline}` : "";
  const noteContent = `${yamlBlock}${bodyOut}`;
  const appendBlock = composeAppendBlock(noteBlockText, placementSource);
  assertEditorSnapshot(plugin, ed, selectionInfo, sourceSnapshot);
  const mutation = await writeInline2Note(plugin, target, noteContent, appendBlock, placementSource);
  const actualTarget = mutation.target;
  /* Заметка, заведённая с этой строки: повтор после отмены допишет в неё (`В-240`). */
  if (!target.exists) {
    plugin._i2nMade = plugin._i2nMade || new Map();
    plugin._i2nMade.set(madeKey(sourcePath, sourceLine), actualTarget.path);
  }
  try {
    assertEditorSnapshot(plugin, ed, selectionInfo, sourceSnapshot);
    const nextRoot = composeSourceRoot(sourceLine, transformContext, cfg, separators, {
      i2n,
      noteTitle: deriveSourceWikilinkFromTargetPath(actualTarget.path),
      explicitTitle,
      titleWords,
      lineFinalize: runtimeOptions && runtimeOptions.lineFinalize,
    });
    replaceEditorSourceBlock(ed, selectionInfo, nextRoot, i2n.sublines, separators, cfg);
  } catch (sourceError) {
    try {
      await mutation.rollback();
    } catch (rollbackError) {
      throw new Error(`source edit failed and target rollback failed: ${sourceError.message}; rollback: ${rollbackError.message}`);
    }
    throw new Error(`source edit failed; target mutation rolled back: ${sourceError && sourceError.message ? sourceError.message : sourceError}`);
  }
  /*
   * Ссылки в заметки, на которые ссылается строка (Н4) — после уборки строки:
   * до этого места правка откатывается целиком, запись в третьи заметки — нет.
   * Отказ громкий, но не роняющий.
   */
  await writeBacklinksIntoReferencedNotes(plugin, transformContext, actualTarget.path, i2n, cfg, sourcePath);
  if (i2n.openTarget) {
    try {
      const opened = plugin.app.vault.getAbstractFileByPath(actualTarget.path);
      if (opened && plugin.app.workspace && typeof plugin.app.workspace.getLeaf === "function") {
        const leaf = plugin.app.workspace.getLeaf(true);
        if (leaf && typeof leaf.openFile === "function") await leaf.openFile(opened);
      }
    } catch (e) {
      /*
       * Заметка создана (путь человек увидит), но не открылась — причина только в
       * журнале (правило отказов, второй вид).
       */
      console.error("[inline-overhaul][inline2note] заметка создана, но не открылась: "
        + String((e && e.message) || e || ""));
    }
  }
  plugin.notice(__say(__noticeKey("transform", "created"), "Note created: {0}", actualTarget.path));
}

module.exports = {
  DEFAULT_INLINE2NOTE,
  /* Список шаблонов: Smart Rules показывает те же, что выбирает движок (П9). */
  collectTemplateOptions,
  /* «Шаблон из назначенной папки»: оба списка панели и нормализация (В-127). */
  templateBelongsToFolder,
  keptTemplateChoice,
  normalizeInline2Note,
  normalizeTransformConfig,
  validateSmartRules,
  parseInlineLine,
  buildTransformContext,
  buildYamlMapFromContext,
  readVaultPropertyTypes,
  parseFrontmatter,
  renderYamlBlockWithOrder,
  resolveAutoTitle,
  /* Имя файла из названия (BUGHUNT R6) и повтор в ту же заметку (`В-240`) — ради проверки. */
  slugSafeTitle,
  sameNoteAgain,
  fillTemplateVariables,
  normalizeYamlValueForFormat,
  /* Откуда название и какой кусок строки им стал: движок, предпросмотр, проверки (У-32). */
  resolveAutoTitleInfo,
  /* Какой кусок строки стал названием: один ответ на перенос и предпросмотр. */
  resolveTitleSwap,
  /* Явное имя в скобках: читается здесь, снимается в двух местах (У-32). */
  explicitTitleOf,
  splitByExplicitTitle,
  splitByTitleWords,
  splitByTitleSource,
  stripExplicitTitleFromLine,
  stripExplicitTitleFromBlock,
  /* Метки элементов и хвосты; показательное значение — для редактора Fields. */
  getElementMarkerRulesFromConfig,
  elementSampleValueFromFormat,
  formatHeaderByMode,
  selectSmartTemplate,
  selectSmartRule,
  buildSourcePreviewTree,
  buildSourcePreviewLine,
  resolveRuleFolder,
  normalizeRuleFolderMode,
  normalizeFolderPath,
  applySourcePayloadReplace,
  applySourceTextFate,
  splitSourcePayload,
  resolveSourceCleanupFieldIds,
  applySourceCleanupByFieldIds,
  planSourceCleanup,
  planSourceLineAfterCleanup,
  applySourcePrefixResolution,
  insertProcessedToken,
  buildPreviewBaseLine,
  deriveSelectionRangeFromEditor,
  normalizeInlineBlockForBody,
  /* `At custom header` (З-4): проверка зовёт те же функции, что движок (У-4). */
  normalizePlacement,
  resolvePlacementSource,
  parseTargetHeaderSpec,
  findCustomHeaderInsertAt,
  placeBlockUnderHeader,
  headerLineForSpec,
  blockWithOwnHeader,
  composeBodyWithPlacement,
  composeAppendBlock,
  appendBlockIntoNote,
  /* Шов конфиг → заметка, наружу ради проверки «настройка доехала до записи» (У-56). */
  writeInline2Note,
  deriveSourceWikilinkFromTargetPath,
  /* Ссылки в заметки строки (Н4): четыре куска наружу — проверки зовут их по одному. */
  backlinkTargetsFromContext,
  backlinkTargetsWithNavigators,
  resolveBacklinkNotePath,
  noteAlreadyLinksTo,
  backlinkLineFor,
  writeBacklinksIntoReferencedNotes,
  runInline2Note,
};
