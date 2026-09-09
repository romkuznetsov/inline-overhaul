"use strict";

/*
 * Видимый текст сообщения по ключу каталога (PRD 10.13.50).
 *
 * Модуль спрашивает `globalThis.__inlineSay` через общий помощник: своей копии
 * этого правила заводить нельзя, из тройки таких копий уже вырос дефект Б-11.
 */
const __say = (() => {
  try {
    const mod = require("../core/say.js");
    if (mod && typeof mod.say === "function") return mod.say;
  } catch (_) {}
  return (key, english, ...args) => args.reduce(
    (out, value, i) => out.split("{" + i + "}").join(String(value == null ? "" : value)),
    String(english == null ? "" : english),
  );
})();

/** Ключ сообщения. Строит его одна функция, и её зовут оба конца (У-82). */
function __noticeKey(area, name) {
  return "notice." + area + "." + name;
}

/*
 * Хвост эмодзи-элемента выводится из формата поля — тем же правилом, каким его
 * выводят разбор строки и отрисовка (`elementTailPatternFromFormat`, У-32).
 *
 * Здесь стояло своё «от метки до пробела», и это было третье объявление того
 * же правила. У Field с форматом `YYYY-MM-DD hh:mm` пробел внутри значения:
 * снималась только дата, время оставалось на исходной строке текстом человека
 * (`- … :: 11:25 [[…]]`), а в свойства заметки уезжало обрезанным
 * (`date_due: 2026-09-07`). Замечание заказчика по R4, 2026-09-07.
 *
 * Модуль подключается литеральным `require` — по одному на модуль (У-89), без
 * заглушки: не приехал — плагин обязан упасть громко.
 */
const __rulesRuntimeHelpers = require("../core/pkm_rules_runtime_helpers.js");

function isObj(v) {
  return !!v && typeof v === "object" && !Array.isArray(v);
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
    /*
      * Единственное из двадцати одного расхождения В-7, где заказчик выбрал
      * схему (2026-08-31): `## Captured` короче и стоит на уровне заголовка,
      * который не спорит с `###` внутри заметки. Поведения это не меняет —
      * меняется текст, который плагин вставляет по умолчанию.
      */
    customHeader: "Captured",
    /* Уровень строки над текстом (10.13.9). `3` — не выбор, а сохранение
       поведения: `###` стоял в коде `formatHeaderByMode`. */
    headerLevel: "3",
    datetimeFormat: "YYYY-MM-DD HH:mm",
    /*
     * `At custom header` (З-4, заказчик 2026-09-08). Пусто — не ошибка, а
     * состояние «заголовок ещё не назван»: положение тогда ведёт себя как
     * запасное. Умолчание запасного — `end`, то же, что у самого положения.
     */
    targetHeader: "",
    fallback: "end",
  },
  yamlNoteFormat: "raw",
  sourceProcessing: {
    cleanupFieldIds: [],
    /*
     * Судьба текста исходной строки, отдельно от ссылки (решение заказчика
     * 2026-09-01). Умолчание совпадает с прежним поведением при
     * `replaceWithLink: true`: текст уходит, на его месте ссылка.
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
  /* Расстояние от последнего символа строки до кнопки, в пикселях
     (10.13.12 Н12, замечание заказчика 2026-09-04). */
  floatingButtonGap: 12,
  preview: {
    sampleLine: "- [ ] #/1 #todo #context",
  },
};

function normalizeMode(raw, allowed, dflt) {
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
 * Виды условия правила — один список на весь модуль.
 *
 * `fields` — условие «любое значение Field» (10.13.7): в нём лежат id Fields,
 * а не токены. Список стоит здесь, потому что раньше эти четыре имени были
 * выписаны в четырёх местах, и четвёртый вид пришлось бы добавлять в каждое.
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
  for (let i = 0; i < dims.length; i++) {
    const d = dims[i];
    const va = Array.isArray(ca[d]) ? ca[d] : [];
    const vb = Array.isArray(cb[d]) ? cb[d] : [];
    if (!va.length || !vb.length) continue;
    if (!intersects(va, vb)) return false;
  }
  return true;
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
   * Вердикт разбора кладётся только в `validation`; `enabled` остаётся тем,
   * что выставил человек.
   *
   * Так решено 2026-08-29 («вывод движка остаётся разбором и в конфиг не
   * попадает», проверка `smart_rules_tests.ts`, раздел 10), и вторая половина
   * решения живёт здесь. `normalizeSmartRules` зовёт эту функцию и идёт внутри
   * `migrateConfig`, то есть на **каждом** патче: записанный в `enabled`
   * вердикт следующий прогон уже не пересчитает — он пропускает выключенные
   * правила, — и человек получит выключенное правило без объяснения и снятый
   * тумблер, которого не касался. Найдено 2026-08-31, когда проверки
   * перестали подменять `normalizeTransformConfig` заглушкой.
   *
   * Поведение при выборе шаблона не меняется: `selectSmartTemplate` и так
   * пропускает правило со `validation.isConflict`.
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

function normalizeSmartRules(rawRules) {
  const src = Array.isArray(rawRules) ? rawRules : [];
  const out = [];
  for (let i = 0; i < src.length; i++) {
    const r = isObj(src[i]) ? src[i] : {};
    const id = String(r.id || `rule-${i + 1}`).trim() || `rule-${i + 1}`;
    const targetTemplate = String(r.targetTemplate || "").trim();
    const conditions = isObj(r.conditions) ? r.conditions : {};
    const tags = Array.isArray(conditions.tags) ? conditions.tags.map((x) => String(x || "").trim()).filter(Boolean) : [];
    const emojiFields = Array.isArray(conditions.emojiFields) ? conditions.emojiFields.map((x) => String(x || "").trim()).filter(Boolean) : [];
    const wikilinks = Array.isArray(conditions.wikilinks) ? conditions.wikilinks.map((x) => String(x || "").trim()).filter(Boolean) : [];
    /* Условие «любое значение Field» (10.13.7): id Fields, не токены. */
    const fields = Array.isArray(conditions.fields) ? conditions.fields.map((x) => String(x || "").trim()).filter(Boolean) : [];
    out.push({
      id,
      /*
       * Имя правила. Его задаёт человек (PRD 10.8 С-3), рантайм его не читает
       * — и до 2026-08-29 эта нормализация его выбрасывала: она пересобирает
       * правило из своих ключей, а `normalizeTransformConfig` идёт внутри
       * `migrateConfig`, то есть на каждом патче. Имя исчезало тем же
       * нажатием, которым его вписали, и настройка была бы мёртвой (З8).
       * Поведение не меняется: ни один проход правил имя не смотрит.
       */
      name: String(r.name || "").trim(),
      enabled: r.enabled !== false,
      targetTemplate,
      conditions: { tags: uniq(tags), emojiFields: uniq(emojiFields), wikilinks: uniq(wikilinks), fields: uniq(fields) },
      /* Папка правила (10.13.8). Два ключа, а не один: папку с именем
         `near current note` иначе не отличить от самого выбора. */
      targetFolderMode: normalizeRuleFolderMode(r.targetFolderMode),
      targetFolder: normalizeFolderPath(r.targetFolder),
      /*
       * `Advanced settings` у правила (З-5). `default` значит «как в
       * `Note content`», и ветка при этом всё равно нормализуется: у неё есть
       * значения, которые человек мог задать и снова выключить, и терять их
       * при переключении режима туда-обратно неоткуда.
       */
      placementMode: normalizeMode(r.placementMode, ["default", "custom"], "default"),
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
 * Прозрачность обработанной строки — процент `0…100` (10.13.12 Н5).
 *
 * В старом файле здесь лежала доля `0…1`, поэтому всё, что не больше единицы,
 * умножается на сто. Ключ до сих пор не читался никем, так что смена единиц
 * ничего не ломает; разные единицы в одной панели однажды сломали бы. Доля
 * ровно `1` означала «непрозрачно» и становится `100`: панель значения ниже
 * двадцати не отдаёт, и спутать его с процентом не с чем.
 */
function normalizeProcessedOpacity(raw) {
  const n = Number(raw);
  if (!Number.isFinite(n)) return DEFAULT_INLINE2NOTE.sourceProcessing.visual.opacity;
  const pct = n > 0 && n <= 1 ? n * 100 : n;
  return Math.max(0, Math.min(100, Math.round(pct)));
}

/**
 * Отступ плавающей кнопки от текста, в пикселях.
 *
 * Границы те же, что у слайдера в панели: панель их показывает, а движок
 * обязан их же соблюдать — иначе рукописный `data.json` уедет за шкалу.
 * Нечисло и отсутствие ключа дают умолчание, а не ноль: ноль это «вплотную»,
 * и он вернул бы ровно тот дефект, из-за которого настройка и появилась.
 */
function normalizeFloatingButtonGap(raw) {
  const n = Number(raw);
  if (!Number.isFinite(n)) return DEFAULT_INLINE2NOTE.floatingButtonGap;
  return Math.max(0, Math.min(40, Math.round(n)));
}

/**
 * Ветка `placement`: куда ложится текст и что стоит над ним.
 *
 * **Одна функция на два места.** Так нормализуется и общая настройка
 * `Note content`, и своя ветка у правила Smart Rules (З-5, заказчик
 * 2026-09-08). Второе объявление разошлось бы с первым молча (У-32), а в этом
 * файле это уже случалось трижды.
 */
function normalizePlacement(raw) {
  const placement = isObj(raw) ? raw : {};
  const out = {};
  out.position = normalizeMode(placement.position, ["beginning", "end", "custom-header"], DEFAULT_INLINE2NOTE.placement.position);
  /*
   * Имя заголовка человек пишет как хочет: `Log`, `## Log`, с пробелами по
   * краям. Решётки здесь **сохраняются**, а не срезаются, и это не небрежность:
   * ими он задаёт уровень искомого заголовка. Написал без них — ищется
   * заголовок любого уровня.
   */
  out.targetHeader = String(placement.targetHeader == null ? DEFAULT_INLINE2NOTE.placement.targetHeader : placement.targetHeader).trim();
  out.fallback = normalizeMode(placement.fallback, ["beginning", "end"], DEFAULT_INLINE2NOTE.placement.fallback);
  out.headerMode = normalizeMode(placement.headerMode, ["custom", "datetime", "none"], DEFAULT_INLINE2NOTE.placement.headerMode);
  /*
   * Решётки живут в `headerLevel`, и только там. С текстбоксов они снимаются
   * на каждой записи: два источника решёток однажды дали бы двойные, а какой
   * из них главный — по строке в заметке не понять (10.13.9 Н3).
   */
  const customParts = splitLeadingHashes(placement.customHeader || DEFAULT_INLINE2NOTE.placement.customHeader);
  const formatParts = splitLeadingHashes(placement.datetimeFormat || DEFAULT_INLINE2NOTE.placement.datetimeFormat);
  out.customHeader = customParts.text || DEFAULT_INLINE2NOTE.placement.customHeader;
  out.datetimeFormat = formatParts.text || DEFAULT_INLINE2NOTE.placement.datetimeFormat;
  /*
   * Ключа `headerLevel` в старом файле нет, и умолчание схемы тут не годится:
   * у человека, писавшего `## Captured`, заголовок молча стал бы мельче.
   * Поэтому уровень **выводится** — из его же решёток, а при `Date and time`
   * из того, что делал код (`###`). Тот же приём, что у `sourceProcessing.text`
   * (У-17), и по той же причине (10.13.9 Н5).
   */
  out.headerLevel = String(Object.prototype.hasOwnProperty.call(placement, "headerLevel")
    ? normalizeHeaderLevel(placement.headerLevel)
    : (customParts.level || (out.headerMode === "datetime" ? 3 : 0)));
  return out;
}

/**
 * Чей `placement` работает на этой строке (З-5).
 *
 * **Подстановка «правило молчит — берём общее» стоит здесь, и только здесь.**
 * Её спрашивают три места — тело новой заметки, блок дописывания и сама
 * запись, — и три ответа на один вопрос разошлись бы молча (У-32).
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
    defaultTemplate: String(src.defaultTemplate || "").trim(),
    smartRules: normalizeSmartRules(src.smartRules),
    noteName: {},
    nameCollision: {},
    placement: {},
    sourceProcessing: {},
    preview: {},
  };

  const noteName = isObj(src.noteName) ? src.noteName : {};
  out.noteName.mode = normalizeMode(noteName.mode, ["auto", "manual"], DEFAULT_INLINE2NOTE.noteName.mode);
  out.noteName.delimiters = String(noteName.delimiters || DEFAULT_INLINE2NOTE.noteName.delimiters).trim() || "[]";
  out.noteName.wordCount = Math.max(1, Math.min(32, Math.trunc(Number(noteName.wordCount) || DEFAULT_INLINE2NOTE.noteName.wordCount)));
  out.noteName.preferHeaderTitle = noteName.preferHeaderTitle !== false;

  const nameCollision = isObj(src.nameCollision) ? src.nameCollision : {};
  out.nameCollision.mode = normalizeMode(nameCollision.mode, ["new_note", "add_to_note", "overwrite"], DEFAULT_INLINE2NOTE.nameCollision.mode);

  out.placement = normalizePlacement(src.placement);
  out.yamlNoteFormat = normalizeMode(src.yamlNoteFormat, ["raw", "clean"], DEFAULT_INLINE2NOTE.yamlNoteFormat);

  const sp = isObj(src.sourceProcessing) ? src.sourceProcessing : {};
  out.sourceProcessing.cleanupFieldIds = Array.isArray(sp.cleanupFieldIds) ? sp.cleanupFieldIds.map((x) => String(x || "").trim()).filter(Boolean) : [];
  out.sourceProcessing.token = Object.prototype.hasOwnProperty.call(sp, "token")
    ? String(sp.token || "").trim()
    : DEFAULT_INLINE2NOTE.sourceProcessing.token;
  out.sourceProcessing.panel = normalizeMode(sp.panel, ["left", "right"], DEFAULT_INLINE2NOTE.sourceProcessing.panel);
  out.sourceProcessing.replaceWithLink = sp.replaceWithLink !== false;
  /*
   * Ключа `text` в старых настройках нет, и умолчание схемы тут не годится:
   * до разделения судьбу текста решал тот же тумблер, что и ссылку. Поэтому
   * при отсутствии ключа она **выводится из него** — иначе у человека,
   * выключившего ссылку, текст начал бы исчезать после обновления.
   */
  out.sourceProcessing.text = Object.prototype.hasOwnProperty.call(sp, "text")
    ? normalizeMode(sp.text, ["leave", "remove", "words", "leave_named"], DEFAULT_INLINE2NOTE.sourceProcessing.text)
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
  out.sublines = normalizeMode(src.sublines, ["stay", "remove"], DEFAULT_INLINE2NOTE.sublines);

  /* Тумблер, а не ветка: `flyingButton.enabled` переехал в `floatingButton`
     одним значением (PRD 8.1б, Р12). Форму версии 1 сюда уже не приносят —
     её разбирает миграция. */
  out.floatingButton = src.floatingButton === true;
  /*
   * Отступ кнопки от текста. Границы те же, что у слайдера в панели: панель
   * их показывает, а движок обязан их же соблюдать — иначе рукописный
   * `data.json` уедет за шкалу. Нечисло и отсутствие ключа дают умолчание, а
   * не ноль: ноль это «вплотную», и он бы вернул ровно тот дефект, из-за
   * которого настройка и появилась.
   */
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

function collectTemplateOptions(app, folder) {
  if (!app || !app.vault || typeof app.vault.getMarkdownFiles !== "function") return [];
  const all = app.vault.getMarkdownFiles();
  /*
   * Путь приводится к виду vault **одной функцией на весь файл**. Здесь стояла
   * её копия из четырёх `replace` — то есть второе объявление одного правила
   * (У-32), и разошлись они ровно в тот день, когда правило дополнили
   * неразрывным пробелом и `NFC` (Р3 списка расхождений, 2026-09-08): папку
   * плагин создавал по одному пути, а шаблоны в ней искал по другому.
   */
  const normalizedFolder = normalizeFolderPath(folder);
  return all
    .filter((f) => {
      if (!normalizedFolder) return true;
      const path = normalizeFolderPath(f.path);
      return path === normalizedFolder || path.startsWith(normalizedFolder + "/");
    })
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
  return String(s || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Метки эмодзи-элементов и длина хвоста у каждой.
 *
 * Отдаёт `[{ marker, tail }]`, где `tail` — образец записи значения, выведенный
 * из формата поля (`YYYY-MM-DD hh:mm` → `\d{4}-\d{2}-\d{2}[ ]\d{2}:\d{2}`).
 * Пусто у тех, у кого формата нет: такие по-прежнему режутся по пробелу.
 *
 * Длинные метки идут первыми: короткая не должна откусывать начало длинной —
 * то же правило, что в `tokenizeSegmentBody`.
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
    out.push({
      marker: finalMarker,
      tail: format ? String(__rulesRuntimeHelpers.elementTailPatternFromFormat(format) || "") : "",
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

/* Из чего собирается показательное значение элемента. Дата настоящая: маска
   `YYYY-MM-DD` на строке не встречается никогда, и подавать её разборщику —
   это подавать ему то, чего он видеть не может (У-38). */
const ELEMENT_SAMPLE_DIGITS = { YYYY: "2026", MM: "08", DD: "31", HH: "09", hh: "09", mm: "15", ss: "00" };

/**
 * Показательное значение элемента, законное для его же формата.
 *
 * Разбирает формат тем же ходом, что `elementTailPatternFromFormat`: буквенный
 * кусок — цифры, всё прочее — само собой. Поэтому что бы человек ни написал
 * форматом, пример останется тем, что разборщик узнает; сверку «пример
 * подходит под образец» держит проверка, и мутация в каждую сторону краснеет
 * (У-92).
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
    MM: String(d.getMonth() + 1).padStart(2, "0"),
    DD: String(d.getDate()).padStart(2, "0"),
    HH: String(d.getHours()).padStart(2, "0"),
    mm: String(d.getMinutes()).padStart(2, "0"),
    ss: String(d.getSeconds()).padStart(2, "0"),
  };
  return String(pattern || "YYYY-MM-DD HH:mm").replace(/YYYY|MM|DD|HH|mm|ss/g, (token) => values[token]);
}

/** Ведущие решётки строки: сколько их, и что остаётся без них. */
function splitLeadingHashes(raw) {
  const src = String(raw || "").trim();
  const m = /^(#{1,6})\s*(.*)$/.exec(src);
  if (!m) return { level: 0, text: src };
  return { level: String(m[1]).length, text: String(m[2] || "").trim() };
}

/**
 * `0` — обычная строка, `1`…`6` — заголовок такой глубины (10.13.9).
 *
 * Наружу отдаётся **число**, а в конфиге лежит строка: значения выпадающего
 * списка в схеме — строки, и хранить их иначе значило бы, что панель не найдёт
 * выбранное. Тот же приём, что у остальных списков.
 */
function normalizeHeaderLevel(raw) {
  const n = Math.trunc(Number(raw));
  if (!Number.isFinite(n)) return Number(DEFAULT_INLINE2NOTE.placement.headerLevel);
  return Math.max(0, Math.min(6, n));
}

/**
 * Строка над вставленным текстом (10.13.9).
 *
 * Решётки ставит **уровень**, а не текст. Раньше при `Date and time` три
 * решётки стояли жёстко в коде, а подсказка советовала вписать их в формат —
 * и `## YYYY-MM-DD` в текстбоксе дало бы в заметке `### ## 2026-09-01`
 * (замечание заказчика 1.6.4.1).
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
  const match = src.match(/^\[\[([^\]|]+)(?:\|[^\]]+)?\]\]$/);
  return match ? String(match[1] || "").trim() : src;
}

/**
 * Какие Fields «стоят» в строке и в какую группу условий каждый из них
 * попадает.
 *
 * Список значений читается из конфига **в момент срабатывания**, а не из
 * правила: значение, добавленное после того, как правило написано, обязано
 * ловиться тем же условием (10.13.7 Н3).
 *
 * Тип Field выводится здесь один раз и отдаётся вместе с ответом: по нему
 * условие «любое значение Field» ложится в группу своего типа. Второе такое
 * же выведение разошлось бы с этим на первой правке (У-32).
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
 * Правило, которое поймало строку, — или `null`.
 *
 * Раньше здесь возвращался сразу шаблон, и папке правила (10.13.8) взять его
 * решение было негде: второй такой же проход разошёлся бы с первым на первой
 * же правке. Теперь проход один, и его результат — само правило.
 *
 * **Условие «любое значение Field» — часть группы своего типа** (решение
 * заказчика 2026-09-03, B14). До этого оно было четвёртой группой, то есть
 * соединялось с остальными через И: Field требовался **вместе** с тегом.
 * Заказчик просил обратное — «вместо того, чтобы накликивать отдельные
 * values», — то есть ИЛИ внутри своего типа. Ветка конфига не менялась:
 * условие по-прежнему лежит в `conditions.fields` и хранит id Field (З1).
 *
 * Field, которого в конфиге больше нет, не попадает ни в одну группу — и
 * правило не блокирует. Прежде такое условие делало правило невыполнимым
 * навсегда, а увидеть его человек не мог: в карточке оно не рисуется.
 */
function selectSmartRule(parsed, smartRules, cfg) {
  const p = isObj(parsed) ? parsed : {};
  const present = {
    tags: new Set(Array.isArray(p.tags) ? p.tags.map((x) => String(x || "").trim()).filter(Boolean) : []),
    wikilinks: new Set(Array.isArray(p.wikilinks) ? p.wikilinks.map(normalizeRuleWikilink).filter(Boolean) : []),
    emojiMarkers: new Set((Array.isArray(p.emojis) ? p.emojis : []).map((x) => String(x && x.marker || "").trim()).filter(Boolean)),
  };
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
 * Путь папки в том виде, в каком его понимает vault.
 *
 * **Правило платформы, и оно спрошено у платформы** (У-44, Р3 списка
 * расхождений с правилами каталога). `normalizePath` в `app.js` 1.13.7 — это
 * `Dl(Bl(e)).normalize("NFC")`, где
 *
 *     Bl(e) = e.replace(/([\\/])+/g, "/").replace(/(^\/+|\/+$)/g, "")   // пусто → "/"
 *     Dl(e) = e.replace(/\u00A0|\u202F/g, " ")
 *
 * Наша функция знала половину: слэши и края. Двух шагов не было, и оба бьют по
 * живому пути от человека.
 *
 *   * **Неразрывный пробел.** Путь папки человек часто вставляет из документа,
 *     а там пробел бывает неразрывным (`U+00A0`). Для vault это другое имя, и папка
 *     создавалась рядом с той, в которую он целился.
 *   * **`NFC`.** `й` и `Проект` набираются двумя способами — одним символом и
 *     буквой с комбинирующим знаком. На macOS файловая система отдаёт
 *     разложенную форму, и путь, набранный руками, с путём из vault не
 *     совпадал.
 *
 * **Одно отличие оставлено намеренно:** пустой путь у нас остаётся пустым, а не
 * становится `"/"`. Пустота здесь — это «корень vault», и на неё ветвится и
 * выбор папки, и создание: `"/"` пришлось бы разбирать обратно.
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
  const panelForSpan = (start) => {
    if (firstSeparator < 0) return "any";
    if (start < firstSeparator) return "left";
    if (secondSeparator >= 0 && start >= secondSeparator + separators.separator2.length) return "right";
    return "payload";
  };
  let m;
  const wlRe = /\[\[([^\]]+)\]\]/g;
  while ((m = wlRe.exec(line)) !== null) {
    const v = String(m[1] || "").trim();
    if (v) wikilinks.push(v);
    const span = { start: m.index, end: m.index + String(m[0] || "").length };
    wikilinkSpans.push(span);
    wikilinkOccurrences.push({ token: v, ...span, panel: panelForSpan(span.start) });
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
        emojiOccurrences.push({ marker, value, ...span, panel: panelForSpan(span.start) });
      }
    }
  }

  const markerPattern = markerRules.length
    ? markerRules
      .map((r) => `${escapeRegexLiteral(r.marker)}\\s*${elementValuePattern(r)}`)
      .join("|")
    : null;
  const payloadTextRaw = extractPrimaryPayloadText(line, separators);
  let textCore = line
    .replace(/\[\[[^\]]+\]\]/g, " ")
    .replace(/(^|\s)(#[^\s#]+)/g, " ")
    .replace(markerPattern ? new RegExp(markerPattern, "g") : /$^/, " ")
    .replace(/\s+/g, " ")
    .trim();
  const payloadParts = textCore.split(String(separators.separator1 || "")).map((s) => String(s || "").trim()).filter(Boolean);
  const payloadText = String(payloadTextRaw || (payloadParts.length ? payloadParts[0] : textCore) || "")
    .replace(/^\s*(?:[-*+]\s+(?:\[[^\]]\]\s+)?|#{1,6}\s+)/, "")
    .trim();
  return { line, tags: uniq(tags), wikilinks: uniq(wikilinks), emojis, payloadText, tagOccurrences, wikilinkOccurrences, emojiOccurrences };
}

function getModeFields(cfg) {
  const behavior = isObj(cfg && cfg.pkm && cfg.pkm.fields) ? cfg.pkm.fields : {};
  const left = isObj(behavior.tags) && Array.isArray(behavior.tags.fields) ? behavior.tags.fields : [];
  const right = isObj(behavior.links) && Array.isArray(behavior.links.fields) ? behavior.links.fields : [];
  return left.concat(right).filter((f) => isObj(f) && String(f.id || "").trim());
}

function fieldTokenCandidates(field) {
  const src = Array.isArray(field && field.values) ? field.values : [];
  const prefix = String(field && field.prefix || "#");
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
  const fields = getModeFields(cfg);
  /*
   * В каком Block Field пишется — говорит Order, а не список определений, в
   * котором Field объявлен.
   *
   * Здесь стояли `pkm.fields.tags.fields` и `pkm.fields.links.fields`: Field
   * из списка ссылок считался «правым» всегда, даже стоя в левом Block. На
   * настоящей строке с разделителями его сторона не совпадала с ожидаемой, он
   * не попадал в совпадения — и не попадал в свойства заметки. Предпросмотр
   * при этом собирает строку **без** разделителей, там сторона у всех `any`,
   * и он показывал Field, которого заметка не получала (замечания заказчика
   * B21 и B11, 2026-09-02).
   *
   * Это та же ловушка `leftMode` / `rightMode`, что закрывалась исключением
   * И-4 для карты токенов (У-9): у ключа Order своя правда, и спрашивать надо
   * её. Дочерний Field стороны не имеет — она у родителя (Ф3).
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

  const pushMatch = (fid, fType, markerOrPrefix, yamlProperty, rawToken, occurrence) => {
    const yp = String(yamlProperty || "").trim();
    const rt = String(rawToken || "").trim();
    if (!rt) return;
    const span = occurrence && Number.isInteger(occurrence.start) && Number.isInteger(occurrence.end)
      ? { start: occurrence.start, end: occurrence.end, panel: occurrence.panel }
      : null;
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

  for (let i = 0; i < fields.length; i++) {
    const f = fields[i];
    const fid = String(f.id || "").trim();
    if (!fid) continue;
    const fType = resolveEffectiveFieldType(f, orderTypes, fid);
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
    const isPanelMatch = (occurrence) => occurrence && (occurrence.panel === expectedPanel || occurrence.panel === "any");

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
          if (occurrence.token !== name || !isPanelMatch(occurrence)) continue;
          const yk = resolveYamlProperty(wlCandidates[wi] && wlCandidates[wi].yamlProperty);
          pushMatch(fid, fType, String(f.prefix || "").trim(), yk, `[[${name}]]`, occurrence);
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

  const dependencySafeMatches = matches.filter((row) => {
    const field = fieldById[String(row && row.fieldId || "").trim()];
    const parentId = String(field && field.dependsOn || "").trim();
    return !parentId || !!byFieldId[parentId];
  });
  const dependencySafeByFieldId = {};
  for (let i = 0; i < dependencySafeMatches.length; i++) {
    const row = dependencySafeMatches[i];
    dependencySafeByFieldId[row.fieldId] = row;
  }

  return {
    line: String(p.line || ""),
    payloadText: String(p.payloadText || ""),
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
  /*
   * Raw пишет то, что стоит в строке, — вместе с маркером элемента.
   * PRD 10.9 Я3, решение заказчика 2026-08-28: до этого элемент терял
   * маркер в обоих режимах, и выбор Raw/Clean на него не влиял вовсе.
   */
  if (mode === "raw") return token;
  if (fieldType === "element") {
    if (fieldPrefix && token.startsWith(fieldPrefix)) return String(token.slice(fieldPrefix.length)).trim();
    const mElement = token.match(/^[\u{1F300}-\u{1FAFF}]\s*(.*)$/u);
    return mElement ? String(mElement[1] || "").trim() : token;
  }
  /*
   * Значение вида `#/1` остаётся **строкой**, а не становится числом.
   *
   * Число отрисовка YAML честно печатает без кавычек, и в списке появлялось
   * `tags: [1, "work", …]`. Свойство типа `tags` в Obsidian ждёт строк, и он
   * ставил у заметки знак «несоответствие типа, ожидалось tags» (замечание
   * B21, 2026-09-02). Кавычки числоподобному значению поставит уже написанное
   * правило (`needsYamlQuotes`), и в заметке выйдет `"1"` — законный тег.
   */
  if (/^#\/\d+$/.test(token)) return String(token.replace(/^#\//, "")).trim();
  if (/^#[^\s#]+$/.test(token)) return String(token.slice(1)).trim();
  if (/^[\u{1F300}-\u{1FAFF}]\d{2}:\d{2}$/u.test(token)) return String(token.slice(2)).trim();
  if (/^[\u{1F300}-\u{1FAFF}]\d{4}-\d{2}-\d{2}$/u.test(token)) return String(token.slice(2)).trim();
  if (/^[\u{1F300}-\u{1FAFF}]\d+$/u.test(token)) return String(token.slice(2)).trim();
  const wl = token.match(/^\[\[([^\]]+)\]\]$/);
  if (wl) return String(wl[1] || "").trim();
  return token;
}

/**
 * Правило значения у Field: `raw` или `clean`. Пусто — своего правила нет.
 *
 * PRD 10.9 Я3 и решение заказчика 2026-08-28: правило задаётся у Field и
 * применяется ко всем его значениям; глобальной настройки формата в новой
 * панели больше нет. Пишет правило блок `Note properties`
 * (`src/ui/settings/custom/yaml_mapping.ts`) ключом `yamlValueRule`.
 */
function normalizeYamlValueRule(raw) {
  const v = String(raw || "").trim().toLowerCase();
  return v === "raw" || v === "clean" ? v : "";
}

/**
 * Типы свойств, объявленные в самом хранилище (Я4).
 *
 * `app.metadataTypeManager` — приватное API: его нет в типах пакета
 * `obsidian`, форма не обещана. Поэтому обязателен feature-detect и тихий
 * отказ: без него запись идёт как раньше, просто без оглядки на объявленный
 * тип.
 *
 * Одно объявление на два места (У-32): этим же читает пример свойства в
 * панели (`yaml_property.ts` берёт функцию из этого модуля), а не своей копией
 * — иначе предпросмотр и заметка разошлись бы.
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
 * Типы Obsidian, у которых значение свойства — **список**.
 *
 * `tags` и `aliases` — встроенные свойства, `multitext` — «список текста».
 * Имена сняты с самого менеджера типов, а не выдуманы.
 */
const YAML_LIST_PROPERTY_TYPES = new Set(["multitext", "tags", "aliases", "list"]);

function buildYamlMapFromContext(transformContext, cfg, propertyTypes) {
  const out = {};
  const byFieldId = isObj(transformContext && transformContext.byFieldId) ? transformContext.byFieldId : {};
  const rows = Array.isArray(transformContext && transformContext.matches)
    ? transformContext.matches
    : Object.keys(byFieldId).map((k) => byFieldId[k]);
  const yamlFormat = String(cfg && cfg.transform && cfg.transform.inline2note && cfg.transform.inline2note.yamlNoteFormat || "raw").trim().toLowerCase();
  const order = isObj(cfg && cfg.pkm && cfg.pkm.fields && cfg.pkm.fields.order) ? cfg.pkm.fields.order : {};
  const propertiesByField = isObj(order.propertiesByField) ? order.propertiesByField : {};
  const cardinalityByField = isObj(order.yamlCardinalityByField) ? order.yamlCardinalityByField : {};
  const propertyFieldCounts = {};
  const listYamlKeys = new Set();
  const singleYamlKeys = new Set();
  const configuredFields = getModeFields(cfg);
  /* Определения по id: правило ищется у того Field, чьё совпадение пришло
     строкой, а у дочернего — ещё и у родителя. */
  const fieldDefById = {};
  for (let i = 0; i < configuredFields.length; i++) {
    const fid = String(configuredFields[i] && configuredFields[i].id || "").trim();
    if (fid) fieldDefById[fid] = configuredFields[i];
  }
  /**
   * Правило значения для одного совпадения. Порядок тот же, что у свойства
   * заметки в `buildTransformContext`: своё, потом родительское, потом общее.
   * Дочерний Field — отдельная запись `<name>_sub` с `dependsOn`, своего
   * контрола у неё нет, и без наследования правило Field не дошло бы до его
   * дочерних значений.
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
   * `Property type` = `One Value` перебивает догадку.
   *
   * Догадка простая: в свойство пишут два и более Field — значит список. Она
   * верна почти всегда, но стояла **после** ручной настройки и молча её
   * перекрывала: свойство `tags`, в которое пишут два Field, оставалось
   * списком, сколько бы раз человек ни выбрал `One Value`. Подсказка контрола
   * при этом обещает обратное — «Set it by hand only when Auto guesses wrong»
   * (замечание заказчика 1.3.2.3).
   *
   * Порядок теперь такой: явный `A list` у любого из Fields — список; иначе
   * явный `One Value` — одно значение; иначе догадка по числу Fields.
   */
  for (const key of Object.keys(propertyFieldCounts)) {
    if (propertyFieldCounts[key] > 1 && !singleYamlKeys.has(key)) listYamlKeys.add(key);
  }
  /*
   * **Тип, объявленный в хранилище, сильнее догадки и сильнее контрола.**
   *
   * Решение заказчика 2026-09-02: свойство `tag` он объявил в Obsidian
   * списком, а плагин написал одно значение — свойство одно, контрол в `Auto`,
   * — и Obsidian ставил «несоответствие типа, ожидалось список» (B21). Теперь
   * плагин сначала спрашивает у хранилища. Свойство, о котором хранилище
   * ничего не знает, решается как раньше: явный контрол, потом догадка по
   * числу Fields.
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

function parseFrontmatter(md) {
  const text = String(md || "");
  const newline = text.includes("\r\n") ? "\r\n" : "\n";
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n)?/);
  if (!m) return { yamlLines: [], body: text, newline };
  const rawYaml = String(m[1] || "");
  const body = String(text.slice(m[0].length) || "");
  const yamlLines = rawYaml.split(/\r?\n/);
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
   * Кавычки у значения свойства ставятся только там, где без них YAML
   * прочитается неправильно.
   *
   * Раньше в кавычки бралось **всё**, и в заметке появлялось
   * `property: "value"`. Документация Obsidian (Help → Properties) пишет
   * текстовое свойство без кавычек — `title: A New Hope`, — и требует их
   * ровно у одного случая: внутренней ссылки, `link: "[[Episode IV]]"`.
   * Замечание заказчика 1.3.2.4, проверено по документации 2026-09-01.
   *
   * Кавычки остаются там, где иначе меняется смысл: пустая строка, ссылка,
   * ведущие и хвостовые пробелы, начало со служебного знака YAML, двоеточие с
   * пробелом или решётка внутри, перенос строки, а также значение, которое
   * без кавычек перестало бы быть текстом — число, `true`, `null` и их родня.
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

function extractHeaderTitle(line) {
  const t = String(line || "").trim();
  const m = t.match(/^#{1,6}\s+(.+)$/);
  return m ? String(m[1] || "").trim() : "";
}

/**
 * Как записано явное имя новой заметки — одна пара скобок и текст внутри.
 *
 * Правило объявлено здесь и только здесь: его спрашивают и тот, кто имя
 * **читает** (`explicitTitleOf`), и те двое, кто его потом со строки
 * **снимает** — исходная строка и текст, уезжающий в заметку. Два объявления
 * разошлись бы молча (У-32), а цена расхождения тут — имя, оставшееся на
 * строке текстом.
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
 * Явное имя, написанное человеком в скобках, — или пусто, если его нет.
 *
 * Вынесено из `resolveAutoTitle` затем, что ответ нужен дважды: имя не только
 * читается, но и **снимается** со строки — оно стало названием заметки и на
 * строке ему делать нечего (замечание заказчика по R4, 2026-09-07).
 */
function explicitTitleOf(line, i2n) {
  const re = explicitTitleRegExp(i2n, "g");
  const lineWithoutWikilinks = String(line || "")
    .replace(/\[\[[^\]]+\]\]/g, " ")
    .replace(/^(\s*[-*+]\s+)\[[^\]]\](\s*)/, "$1$2");
  let m;
  while ((m = re.exec(lineWithoutWikilinks)) !== null) {
    const explicit = String(m[1] || "").trim();
    if (explicit) return explicit;
  }
  return "";
}

/**
 * Разрезать текст по тому месту, где стояло явное имя.
 *
 * Отдаёт `{ head, tail, found }`: что стояло до имени и что после. Место имени
 * нужно ссылке — она встаёт туда, где имя и было, поэтому строка заказчика
 * `[тест-трансформ] тест1` даёт `[[333/тест-трансформ]] тест1`, а не
 * `тест1 [[333/тест-трансформ]]`.
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
 * Разрезать текст по тому месту, где стояли слова, ставшие названием.
 *
 * Слова снимаются **по одному и по порядку**, а не отрезанием начала строки:
 * между ними может стоять то, что в название не пошло, — Value отмеченного
 * Field остаётся на строке, а `payloadText` его не видит. Такой токен остаётся
 * с левой половиной, а не пропадает.
 *
 * Не нашлось всех слов — разреза нет, и вызывающий работает по-прежнему: имя
 * могло быть набрано в окне вручную, а строка с тех пор измениться.
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
 * Где на строке стояло название — в одном ответе на оба его вида.
 *
 * Вызывающему всё равно, из скобок пришло имя или из первых слов: он ставит на
 * это место ссылку. Поэтому и спрашивает он один раз, а не разбирает вид имени
 * у себя.
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
 * Откуда взялось название заметки и какой кусок строки им стал.
 *
 * Порядок «имя в скобках → заголовок → первые слова текста» объявлен **здесь и
 * только здесь**: его спрашивает и тот, кто название читает, и те, кто потом
 * ставит на его место ссылку. Второе объявление этого порядка разошлось бы с
 * первым молча (У-32), а цена расхождения — ссылка, вставшая не туда, где
 * человек ждёт её увидеть.
 *
 * `origin`:
 *   `explicit` — имя в скобках `naming-delimiters`; со строки уходит всегда,
 *                оно не текст, а название;
 *   `header`   — заголовок строки; на строке его и не было;
 *   `words`    — первые `wordCount` слов текста. Это и есть текст человека,
 *                поэтому уходит он только там, где текст и так не сохраняется
 *                целиком (замечание заказчика по T1, 2026-09-07);
 *   `""`       — названия нет.
 */
function resolveAutoTitleInfo(parsed, i2n) {
  const line = String(parsed && parsed.line || "");
  const payload = String(parsed && parsed.payloadText || "").trim();
  const explicit = explicitTitleOf(line, i2n);
  if (explicit) return { title: explicit, origin: "explicit" };
  if (i2n && i2n.noteName && i2n.noteName.preferHeaderTitle) {
    const hh = extractHeaderTitle(line);
    if (hh) return { title: hh, origin: "header" };
  }
  const base = payload && payload !== "-" ? payload : "";
  const wordsN = Math.max(1, Math.min(32, Math.trunc(Number(i2n && i2n.noteName && i2n.noteName.wordCount) || 6)));
  const words = base.split(/\s+/).filter(Boolean).slice(0, wordsN);
  if (words.length) return { title: words.join(" "), origin: "words" };
  return { title: "", origin: "" };
}

function resolveAutoTitle(parsed, i2n) {
  return resolveAutoTitleInfo(parsed, i2n).title;
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
         * Вид — классами, а не свойствами узла (правило каталога Р7). Правила
         * лежат в `styles.css`, разделом «Окна плагина вне панели»: у
         * оформления один дом, и `styles.css` Obsidian читает сам.
         */
        const input = this.contentEl.createEl("input", { type: "text", cls: "io-i2n-title__input" });
        input.setAttribute("aria-label", "Note title");
        const buttons = this.contentEl.createDiv({ cls: "io-i2n-title__actions" });
        const cancel = buttons.createEl("button", { text: "Cancel" });
        const submit = buttons.createEl("button", { text: "Create" });
        submit.classList.add("mod-cta");
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

function slugSafeTitle(raw) {
  return String(raw || "")
    .trim()
    .replace(/[\\/:*?"<>|]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Папка новой заметки: своя у правила или общая (10.13.8).
 *
 * `default` — как `New notes folder`; `near` — рядом с текущей заметкой, то
 * есть так, как ведёт себя пустой `New notes folder`; `folder` — своя папка
 * правила. Пустая своя папка означает то же, что `default`: обещать место,
 * которого не назвали, нельзя.
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

async function pickTargetPath(plugin, title, i2n, rule) {
  const app = plugin.app;
  let folder = resolveRuleFolder(rule, i2n);
  if (!folder) {
    try {
      const activeFile = app && app.workspace && typeof app.workspace.getActiveFile === "function" ? app.workspace.getActiveFile() : null;
      /*
       * Папка активной заметки проходит ту же нормализацию, что и папка из
       * настроек. У заметки в корне Obsidian отдаёт `parent.path === "/"`, и
       * без нормализации путь склеивался через два слэша: файл создавался как
       * `тест.md` (Obsidian путь чистит сам), а в исходную строку уходила
       * ссылка `[[//тест]]` — она собирается из пути до чистки
       * (замечание заказчика B21, 2026-09-02).
       */
      folder = normalizeFolderPath(activeFile && activeFile.parent ? activeFile.parent.path : "");
    } catch (_) {}
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
 * Разбор исходной строки на «до текста», сам текст и «после текста».
 *
 * Раньше эта раскладка жила внутри замены текста ссылкой и была ей не нужна:
 * замена выбрасывала текст, не читая. Теперь текст надо ещё и **прочитать** —
 * его можно оставить целиком или обрезать до первых слов, — и второй разбор
 * той же строки разошёлся бы с первым на ближайшей правке. Поэтому разбор
 * один, а склейка обратно (`joinSourcePayload`) повторяет прежние ветки
 * дословно, включая то, что при пустом хвосте второй Separator не пишется.
 *
 * **Один Separator на строке — два разных устройства, и текстом они не
 * различаются** (замечание заказчика по T4, 2026-09-07). `text :: right` и
 * `left :: text` выглядят одинаково, а при равных Separator (`::` и `::` —
 * умолчание) одинаковы буквально. Разбор по умолчанию читает такую строку как
 * «левая часть и текст»; `shape.payloadFirst` говорит, что левый сегмент снят
 * уборкой Fields, оставшийся Separator — второй, и текст стоит **до** него.
 * Знание это не выводится из строки, а приходит от того, кто её схлопнул:
 * `planSourceCleanup`.
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
        const prefix = String((head.match(/^[-*+]\s+(?:\[.\]\s+)?/u) || [""])[0] || "");
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
  const bullet = src.match(/^([\s]*[-*]\s+)(.+)$/);
  if (bullet) {
    return { kind: "bullet", src, s1, s2, prefix: bullet[1], payload: String(bullet[2] || "").trim() };
  }
  /* Ни Separator, ни маркера списка: читать нечего, дописывать — в конец. */
  return { kind: "none", src, s1, s2, payload: "" };
}

/**
 * Собрать строку обратно с новым текстом на месте прежнего.
 *
 * Пустые куски не дают пустых мест: текста может не остаться вовсе (`Take it
 * away` без ссылки), и тогда между Separator получалось два пробела. По той же
 * причине уходит и ведущий пробел у строки, которая начинается с Separator.
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
   * Левого сегмента нет, и Separator на строке один — тот, что стоит между
   * текстом и правой частью. Пустой текст слот за собой оставляет: без
   * Separator правая часть слилась бы с прозой (У-74 про то же правило с
   * другой стороны).
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
 * Судьба текста исходной строки и ссылка на заметку — **две разные вещи**
 * (решение заказчика 2026-09-01). До этого обе жили в одном тумблере
 * `replaceWithLink`, и из четырёх сочетаний были достижимы два: «текст ушёл,
 * ссылка есть» и «текст остался, ссылки нет». Заказчику нужны и остальные:
 * оставить текст И получить ссылку, оставить первые слова текста.
 *
 * `text`:
 *   `leave`  — текст остаётся целиком;
 *   `remove` — текст уходит в заметку и со строки убирается;
 *   `words`  — на строке остаются первые `keepWords` слов.
 *
 * **Явное имя в скобках текстом не считается** (замечание заказчика по R4,
 * 2026-09-07). Оно стало названием заметки, поэтому со строки уходит, в счёт
 * слов не идёт — и ссылка встаёт ровно туда, где имя стояло:
 *
 *   было   `- [ ] #todo :: [тест-трансформ] тест1 :: 📅2026-09-07 11:25`
 *   стало  `- [[333/тест-трансформ]] тест1 :: #processed`
 *
 * **И то же самое — со словами, из которых название собралось само**
 * (замечание заказчика по T1, 2026-09-07): его строка
 * `:: тест-трансформ4 тест1 … тест6 ::` при `wordCount` = 6 давала название из
 * шести слов, а на строке эти же слова оставались текстом, и ссылка вставала
 * за ними. Стало: ссылка встаёт **на место** этих слов, а на строке остаётся
 * то, что в название не пошло, — `[[…]] тест6`. В счёт `keepWords` слова
 * названия не идут: считается остаток.
 *
 * Имена приходят готовыми в `explicitTitle` и `titleWords`: решает, откуда
 * взялось название, `resolveAutoTitleInfo`, и переспрашивать его здесь значило
 * бы завести второе объявление правила (У-32). Пусто — прежний порядок «текст,
 * потом ссылка».
 */
function applySourceTextFate(line, noteTitle, separators, opts) {
  const src = String(line || "");
  const fate = normalizeMode(opts && opts.text, ["leave", "remove", "words", "leave_named"], "remove");
  const link = !!(opts && opts.link);
  const title = String(noteTitle || "").trim();
  const linkText = link && title ? ("[[" + title + "]]") : "";
  const parts = splitSourcePayload(line, separators, opts && opts.shape);
  /*
   * Слова, ставшие названием, снимаются только там, где **на их место встаёт
   * ссылка**.
   *
   * Два условия, и оба обязательны. Положение: `leave` обещает строку как была
   * — снять из неё шесть слов значило бы отменить выбор человека; при `remove`
   * текста не остаётся вовсе, и снимать нечего. И ссылка: без неё на месте
   * снятых слов не окажется ничего, а «заменить» значит поставить что-то
   * вместо (замечание заказчика по T1, решение В-78 2026-09-07).
   *
   * `leave_named` — третье положение, заведённое его решением: текст остаётся
   * целиком, кроме слов названия, и число слов ниже к нему не применяется.
   *
   * Имя в скобках уходит при любом положении: оно не текст, а название.
   */
  const swapsName = fate === "words" || fate === "leave_named";
  const titleWords = linkText && swapsName ? (opts && opts.titleWords) : "";
  const named = splitByTitleSource(parts.payload, opts && opts.explicitTitle, titleWords, opts && opts.i2n);
  /*
   * Текст остаётся, ссылки нет — строку не трогаем вовсе. Не осторожность:
   * склейка нормализует пробелы вокруг Separator, и строка, которую человек
   * не просил менять, менялась бы на пробел. Имя в скобках — исключение: его
   * надо снять и тогда.
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

function insertProcessedToken(line, token, panel, separators, shape) {
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
   * Левый сегмент снят уборкой: единственный Separator строки — второй, и
   * правая часть стоит **за** ним. Без этого знания метка приписывалась в
   * конец строки через ещё один Separator, и правая часть человека оказывалась
   * текстом (замечание заказчика по T4, 2026-09-07).
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
    if (first >= 0) return `${indent}${body.slice(0, first).trimEnd()} ${processed} ${body.slice(first).trimStart()}`;
    const prefix = body.match(/^([-*+]\s+(?:\[[^\]]\]\s+)?)/);
    if (prefix) return `${indent}${prefix[1]}${processed} ${body.slice(prefix[1].length)}`.trimEnd();
    return `${indent}${processed}${body ? " " + body : ""}`;
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
  return selected.filter((id) => known.has(id));
}

/**
 * Уборка Values со строки **и** то, каким стало её устройство.
 *
 * Схлопывание пустого слота знает, какой слот исчез, — и до 2026-09-07 это
 * знание выбрасывалось вместе с возвратом одной строки. Дальше по ходу три
 * шага разбирали строку заново, а разобрать её нельзя: `text :: right` и
 * `left :: text` при одинаковых Separator — одна и та же строка (замечание
 * заказчика по T4). Поэтому ход один, а `applySourceCleanupByFieldIds`
 * остался тонкой обёрткой: второе такое же вычисление разошлось бы с этим на
 * первой правке (У-32).
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
  const plan = planSourceLineAfterCleanup(out, separators);
  return { line: `${leadingIndent}${plan.line}`, payloadFirst: plan.payloadFirst };
}

function applySourceCleanupByFieldIds(line, transformContext, cleanupFieldIds, separators) {
  return planSourceCleanup(line, transformContext, cleanupFieldIds, separators).line;
}

function applySourcePrefixResolution(line, originalLine, transformContext, preservedFieldIds, cfg, lineFinalize) {
  const original = String(originalLine || "");
  const prefixMatch = original.match(/^([\t ]*)([-*+]\s+)(?:\[([^\]]*)\]\s+)?/);
  if (!prefixMatch) return String(line || "");
  if (!lineFinalize || typeof lineFinalize.buildPrefixUnified !== "function") {
    throw new Error("shared prefix resolver unavailable");
  }
  const pkm = isObj(cfg && cfg.pkm) ? cfg.pkm : {};
  const behavior = { prefixRules: pkm.prefixRules, order: pkm.fields && pkm.fields.order };
  if (!isObj(behavior.prefixRules)) return String(line || "");
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
  const indent = String((String(line || "").match(/^[\t ]*/) || [""])[0] || "");
  const body = String(line || "").slice(indent.length).replace(/^[-*+]\s+(?:\[[^\]]\]\s+)?/, "").trimStart();
  return `${indent}${resolved}${body ? " " + body : ""}`.trimEnd();
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
 * Строка после уборки — и ответ на «где теперь текст».
 *
 * `payloadFirst` ставится ровно в одной ветке: левый сегмент пуст, а текст и
 * правая часть на месте. Тогда Separator на строке остаётся один, и он
 * **второй**. Голый маркер списка (`- ` без чекбокса) прежним пустым слотом не
 * считается и здесь: `dropPrefix` снимает только чекбокс, и строка вида
 * `- :: text :: right` остаётся с двумя Separator — так её и ждёт заказчик
 * (его пример к T4).
 */
function planSourceLineAfterCleanup(line, separators) {
  const src = String(line || "").trim();
  const plain = (value) => ({ line: value, payloadFirst: false });
  if (!src) return plain(src);
  const s1 = String(separators && separators.separator1 || "").trim();
  const s2 = String(separators && separators.separator2 || "").trim();
  if (!s1 || !s2) return plain(src);
  const parts = src.split(s1).map((x) => String(x || "").trim());
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
    /* Слово `value` разборщик элемента больше не узнаёт: значение читается по
       формату поля. Пример обязан быть законным для того, кто его прочтёт. */
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
 * Текст выдуманной строки предпросмотров и её префикс.
 *
 * Оба видимые, поэтому названы, а не вписаны посреди сборки строки. Префикс —
 * буллит с чекбоксом: без него в половинах «до» и «после» не было видно, что
 * с началом строки вообще что-то происходит, а происходит там немало —
 * `Prefix behavior` у Value, `Bullet in strict` и метка «обработано»
 * (замечание заказчика B13, 2026-09-02).
 */
/*
 * Текст выдуманной строки **длиннее названия**, и это условие, а не вкус.
 *
 * Ссылка на заметку встаёт на место слов, из которых название собралось
 * (замечание заказчика по T1, 2026-09-07). Текста было ровно шесть слов при
 * `wordCount` = 6 — то есть весь он уходил в название, на строке оставалась
 * одна ссылка, и `Words to keep` в предпросмотре не менял ничего. Теперь
 * видны оба конца правила: ссылка на месте названия и остаток, которым
 * ползунок и распоряжается.
 */
const PREVIEW_TEXT_WORDS = "buy milk and bread on the way home after work today";
const PREVIEW_LINE_PREFIX = "- [ ] ";

function buildPreviewBaseLine(cfg) {
  const separators = resolveIoSeparators(cfg);
  const behavior = isObj(cfg && cfg.pkm && cfg.pkm.fields) ? cfg.pkm.fields : {};
  const order = isObj(behavior.order) ? behavior.order : {};
  const labels = isObj(order.labels) ? order.labels : {};
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
    const label = String(labels[fid] || fid).trim();
    const composed = `${token}`;
    const parentId = String(field && field.dependsOn || "").trim();
    if (rightOrder.has(fid) || parentId && rightOrder.has(parentId)) rightTokens.push(composed);
    else if (leftOrder.has(fid) || parentId && leftOrder.has(parentId)) leftTokens.push(composed);
    else leftTokens.push(composed);
    void label;
  }
  const left = leftTokens.join(" ").trim();
  const right = rightTokens.join(" ").trim();
  /*
   * Текст выдуманной строки — несколько слов, а не одно.
   *
   * Стояло одно слово `Text`, и на нём не было видно, работает ли
   * `Words to keep`: сколько бы слов ни просили оставить, оставалось то же
   * одно. Заказчик так и написал: «в live preview текст состоит из одного
   * слова "text", так что не понятно, работает ли source-keep-words» (B18,
   * 2026-09-02). Слов шесть — больше, чем предел ползунка по умолчанию, и
   * меньше, чем строка, в которой их уже не пересчитать глазами.
   */
  const text = PREVIEW_TEXT_WORDS;
  const p = PREVIEW_LINE_PREFIX;
  if (left && right) return `${p}${left} ${separators.separator1} ${text} ${separators.separator2} ${right}`;
  if (left) return `${p}${left} ${separators.separator1} ${text}`;
  if (right) return `${p}${text} ${separators.separator2} ${right}`;
  return p + text;
}

/**
 * Дерево «до и после» для предпросмотра `Source line` (10.13.10).
 *
 * Считает **тот же путь**, что переносит строку по-настоящему: разбор строки,
 * очистка по `cleanupFieldIds`, судьба текста, метка «обработано». Свой разбор
 * разошёлся бы с движком на первой правке (У-4), поэтому здесь только сборка
 * дерева вокруг него.
 *
 * Дочерние строки — те же самые, что родительская, но с другим текстом и
 * отступом: заказчик просил показать строку, «полностью заполненную всеми
 * имеющимися Fields», и её детей.
 *
 * Судьба детей — не наша: её решает `Sub-lines (tree) behavior` в
 * `Note content`. `stay` — они остаются на месте нетронутыми, `remove` — они
 * уходят в заметку вместе с текстом, и на странице их больше нет.
 */
function buildSourcePreviewTree(i2n, cfg) {
  const base = buildPreviewBaseLine(cfg);
  if (!base) return { before: [], after: [] };
  const separators = resolveIoSeparators(cfg);
  /*
   * Fields нет — показывать нечего: без них строка вырождается в одно слово
   * `Text`, и предпросмотр говорил бы неправду о настройках. Признак берётся
   * оттуда же, откуда строка: Separator в ней появляется только вместе с
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
  const ids = resolveSourceCleanupFieldIds(i2n, cfg);
  const plan = planSourceCleanup(before, ctx, ids, separators);
  const shape = { payloadFirst: plan.payloadFirst };
  const cleaned = plan.line;
  /* Предпросмотр спрашивает про название **тем же** ходом, что и движок:
     иначе он показывал бы ссылку не там, где её поставит перенос (У-32). */
  const titled = resolveAutoTitleInfo(parsed, i2n);
  const linked = applySourceTextFate(cleaned, "Preview", separators, {
    text: i2n && i2n.sourceProcessing && i2n.sourceProcessing.text,
    keepWords: i2n && i2n.sourceProcessing && i2n.sourceProcessing.keepWords,
    link: !!(i2n && i2n.sourceProcessing && i2n.sourceProcessing.replaceWithLink),
    explicitTitle: titled.origin === "explicit" ? titled.title : "",
    titleWords: titled.origin === "words" ? titled.title : "",
    i2n,
    shape,
  });
  const processed = insertProcessedToken(
    linked,
    i2n && i2n.sourceProcessing && i2n.sourceProcessing.token,
    i2n && i2n.sourceProcessing && i2n.sourceProcessing.panel,
    separators,
    shape
  );
  const after = normalizePreviewSeparators(normalizeSourceLineAfterCleanup(processed, separators), separators);
  return { before, after };
}


function indentSize(line) {
  const s = String(line || "");
  const m = s.match(/^[\t ]*/);
  const raw = m ? String(m[0] || "") : "";
  let n = 0;
  for (let i = 0; i < raw.length; i++) n += raw[i] === "\t" ? 2 : 1;
  return n;
}

function deriveRootBlockFromEditor(ed, lineNo) {
  if (!ed || typeof ed.getLine !== "function") {
    return { rootIndex: 0, rootLine: "", blockStart: 0, blockEnd: 0, blockLines: [""], allLines: [""] };
  }
  const rootLine = String(ed.getLine(lineNo) || "");
  const baseIndent = indentSize(rootLine);
  const total = typeof ed.lineCount === "function" ? Number(ed.lineCount() || 0) : (lineNo + 1);
  let end = lineNo;
  for (let i = lineNo + 1; i < total; i++) {
    const cur = String(ed.getLine(i) || "");
    if (!cur.trim()) { end = i; continue; }
    const curIndent = indentSize(cur);
    if (curIndent > baseIndent) {
      end = i;
      continue;
    }
    break;
  }
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
  const baseIndent = indentSize(rootLine);
  let end = selectedEnd;
  for (let i = selectedEnd + 1; i < total; i++) {
    const line = String(ed.getLine(i) || "");
    if (!line.trim()) {
      end = i;
      continue;
    }
    if (indentSize(line) <= baseIndent) break;
    end = i;
  }
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

function replaceEditorSourceBlock(ed, info, nextRootLine, sublines) {
  if (!ed || typeof ed.replaceRange !== "function") throw new Error("editor replace API unavailable");
  const start = Number(info.blockStart || 0);
  const end = Number(info.blockEnd || start);
  if (String(sublines || "stay").trim().toLowerCase() !== "remove") {
    const oldRoot = String(ed.getLine(start) || "");
    ed.replaceRange(String(nextRootLine || ""), { line: start, ch: 0 }, { line: start, ch: oldRoot.length });
    return;
  }
  const total = typeof ed.lineCount === "function" ? Number(ed.lineCount() || 0) : end + 1;
  if (end + 1 < total) {
    ed.replaceRange(`${String(nextRootLine || "")}\n`, { line: start, ch: 0 }, { line: end + 1, ch: 0 });
    return;
  }
  const endText = String(ed.getLine(end) || "");
  ed.replaceRange(String(nextRootLine || ""), { line: start, ch: 0 }, { line: end, ch: endText.length });
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
 * Строка `Type name of header`, разобранная на уровень и текст (З-4).
 *
 * `null` — имя не задано, и положение `At custom header` тогда ничем не
 * отличается от своего запасного: искать нечего.
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
 * Номер строки, ПЕРЕД которой ложится блок: конец секции найденного заголовка.
 * `-1` — заголовка в теле нет.
 *
 * Три решения, каждое из которых видно человеку:
 *
 *   * **два одноимённых заголовка — берётся первый.** Второй адресовать нечем:
 *     в настройке лежит имя, а не номер;
 *   * **регистр не важен.** Имя набирает человек в одном месте и заголовок — в
 *     другом, и `## Log` против `## log` не должно значить «не нашёл»;
 *   * **уровень важен ровно тогда, когда его написали.** `## Log` ищет
 *     заголовок второго уровня, `Log` — любого.
 *
 * Пустые строки в конце секции — отступ перед следующим заголовком, а не её
 * содержимое: блок встаёт до них.
 */
function findCustomHeaderInsertAt(lines, spec) {
  if (!spec) return -1;
  const wanted = String(spec.text || "").toLowerCase();
  let at = -1;
  for (let i = 0; i < lines.length; i++) {
    const h = readHeadingLine(lines[i]);
    if (!h) continue;
    if (spec.level && h.level !== spec.level) continue;
    if (h.text.toLowerCase() !== wanted) continue;
    at = i;
    break;
  }
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
 * Тело заметки с положенным в него блоком (З-4).
 *
 * **Одна функция на оба пути** — новая заметка и дописывание в существующую.
 * Второе объявление правила «куда ложится текст» разошлось бы с первым молча
 * (У-32), а в этом файле это уже случалось трижды.
 *
 * `null` значит «заголовок не найден»: решение, что делать дальше, принимает
 * вызывающий, потому что запасные положения у двух путей разные.
 */
function placeBlockUnderHeader(baseBody, block, spec, nl) {
  const lines = String(baseBody || "").replace(/\r?\n/g, nl).split(nl);
  const at = findCustomHeaderInsertAt(lines, spec);
  if (at === -1) return null;
  const head = lines.slice(0, at);
  const tail = lines.slice(at);
  const blockLines = String(block || "").split(nl);
  const out = head.slice();
  /*
   * Пустая строка с обеих сторон, и это то же самое, что делает `At the end`:
   * запись отделяется от соседей. Без неё наш заголовок слипся бы с чужим
   * абзацем в один, а Obsidian нарисовал бы их одной строкой.
   */
  if (out.length && String(out[out.length - 1] || "").trim()) out.push("");
  for (const line of blockLines) out.push(line);
  if (tail.length && String(tail[0] || "").trim()) out.push("");
  for (const line of tail) out.push(line);
  return out.join(nl);
}

/**
 * Заголовок, который мы заводим сами, когда названного в заметке нет (S4).
 *
 * **Замечание заказчика 2026-09-08:** «хочу изменить логику — если
 * `At custom header` не найден, то тогда он должен сам добавиться в заметке в
 * зависимости от варианта `If header not found`». Прежде запись ложилась в то
 * же место, но **без** заголовка: человек выбирал положение ради секции, а
 * получал запись вне всякой секции.
 *
 * **Уровень берётся из имени, а не выдумывается.** `## Log` в настройке значит
 * «второй уровень», и заведённый заголовок обязан быть ровно таким: иначе
 * следующий запуск своего же заголовка не найдёт и завёл бы второй. Решёток
 * человек не написал — уровень ему безразличен, и ставится первый, ровно то,
 * что показывает плейсхолдер строки (`# Header name`).
 *
 * Имени нет вовсе — заводить нечего, и положение работает как работало: пустая
 * строка `Type name of header` ошибкой не считается.
 */
function headerLineForSpec(spec) {
  if (!spec) return "";
  const text = String(spec.text || "").trim();
  if (!text) return "";
  const level = Math.max(1, Math.min(6, Number(spec.level) || 1));
  return `${"#".repeat(level)} ${text}`;
}

/**
 * Блок вместе с заведённым для него заголовком (S4).
 *
 * Одно объявление на оба пути — новая заметка и дописывание, — по той же
 * причине, по какой одна на двоих `placeBlockUnderHeader`: в этом файле два
 * объявления правила укладки расходились трижды (У-32).
 */
function blockWithOwnHeader(block, spec, nl) {
  const body = String(block || "");
  const header = headerLineForSpec(spec);
  return header ? `${header}${nl}${body}` : body;
}

function composeAppendBlock(inlineText, i2n) {
  const placement = isObj(i2n && i2n.placement) ? i2n.placement : {};
  const header = formatHeaderByMode({ placement: { ...placement, headerMode: "datetime" } });
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
  /*
   * `At custom header` (З-4): блок ложится **в конец секции** названного
   * заголовка — решение заказчика. Заголовка в заметке нет — заголовок
   * **заводится сам**, и запасное положение говорит, где именно (S4).
   *
   * Ветка стоит **до** проверки на пустое тело нарочно: у новой заметки без
   * шаблона тело и есть пустое, и заголовка в нём тоже нет — то есть это самый
   * частый случай «не нашёл», а не исключение из него.
   */
  if (pos === "custom-header") {
    const spec = parseTargetHeaderSpec(placement.targetHeader);
    const placed = placeBlockUnderHeader(base, block, spec, nl);
    if (placed !== null) return placed;
    const own = blockWithOwnHeader(block, spec, nl);
    if (!base.trim()) return own + nl;
    const fallback = String(placement.fallback || "end").trim().toLowerCase();
    if (fallback === "beginning") return `${own}${nl}${nl}${base}`;
    return `${base.replace(/\r?\n/g, nl)}${nl}${nl}${own}`;
  }
  if (!base.trim()) return block + nl;
  if (pos === "beginning") return `${block}${nl}${nl}${base}`;
  return `${base.replace(/\r?\n/g, nl)}${nl}${nl}${block}`;
}

/**
 * Дописывание в существующую заметку (`Add to the existing one`).
 *
 * **Дописывание всегда шло в конец, и это не меняется:** положения
 * `At the beginning` и `At the end` тут работают так же, как работали. Новое —
 * `At custom header`: без него положение действовало бы только на новых
 * заметках, а человек выбирает его один раз на обе дороги.
 *
 * Frontmatter отрезается до поиска: решётки внутри YAML заголовками не
 * являются, и вставка выше `---` испортила бы свойства заметки.
 */
function appendBlockIntoNote(previous, block, i2n, nl) {
  const before = String(previous == null ? "" : previous);
  const text = String(block || "").trim().replace(/\r?\n/g, nl);
  if (!text) return before;
  const placement = isObj(i2n && i2n.placement) ? i2n.placement : {};
  const pos = String(placement.position || "end").trim().toLowerCase();
  if (pos !== "custom-header") return `${before.trimEnd()}${nl}${nl}${text}${nl}`;

  const parsed = parseFrontmatter(before);
  const head = before.slice(0, before.length - parsed.body.length);
  const spec = parseTargetHeaderSpec(placement.targetHeader);
  const placed = placeBlockUnderHeader(parsed.body, text, spec, nl);
  if (placed !== null) return `${head}${placed}`;
  /* Заголовка в заметке нет — заводится сам, тем же правилом, что и у новой
     заметки (S4). Второе правило «как выглядит заведённый заголовок»
     разошлось бы с первым молча (У-32). */
  const own = blockWithOwnHeader(text, spec, nl);
  const fallback = String(placement.fallback || "end").trim().toLowerCase();
  if (fallback === "beginning") {
    const body = parsed.body.replace(/\r?\n/g, nl);
    return body.trim() ? `${head}${own}${nl}${nl}${body}` : `${head}${own}${nl}`;
  }
  return `${before.trimEnd()}${nl}${nl}${own}${nl}`;
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
      const folderPath = candidate.replace(/\\/g, "/").replace(/\/[^/]*$/, "");
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
    const folderPath = String(target.path || "").replace(/\\/g, "/").replace(/\/[^/]*$/, "");
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
   * **Правка чужой заметки идёт через `Vault.process`** — правило каталога
   * Obsidian, Р8 списка расхождений (2026-09-08).
   *
   * Было: `vault.read`, потом `vault.modify`. Между двумя вызовами заметка
   * может измениться — её правит сам человек в соседней вкладке, — и `modify`
   * записал бы поверх его правки то, что прочитал секунду назад.
   * `process` делает то же одним ходом: читает, отдаёт функции и пишет
   * результат, не давая двум записям наступить друг на друга.
   *
   * **И это заодно починило откат.** Прежнее содержимое читалось ДО записи, и
   * при чужой правке между чтением и записью откат вернул бы заметку не к
   * тому, что в ней было, а к тому, что мы успели прочитать. Теперь оно
   * запоминается внутри самого хода — то есть ровно то, что мы перезаписали.
   *
   * `process` объявлен в `obsidian.d.ts` и есть у всех, кто поставит плагин:
   * `minAppVersion` — `1.13.0`. Запасного пути на `modify` поэтому нет —
   * ветка, которую никто не выполнит, хуже её отсутствия (У-90).
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
  if (!i2n.enabled) {
    plugin.notice(__say(__noticeKey("transform", "module-off"), "Transform is switched off"));
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
   * Имя, написанное человеком в скобках, — не текст строки, а её название
   * (замечание заказчика по R4, 2026-09-07). Оно снимается и с того, что
   * уезжает в заметку, и с того, что остаётся на строке. Снимается **только
   * то, что и правда стало названием**: имя, набранное в окне вручную, скобок
   * на строке не касается.
   */
  const explicitTitle = title === explicitTitleOf(sourceLine, i2n) ? title : "";
  /*
   * Слова, из которых название собралось само, — тоже название, и ссылка
   * встаёт на их место (замечание заказчика по T1, 2026-09-07). Снимается
   * **только то, что и правда стало названием**: имя из заголовка или
   * набранное в окне вручную слов на строке не касается.
   */
  const titled = resolveAutoTitleInfo(parsed, i2n);
  const titleWords = !explicitTitle && titled.origin === "words" && title === titled.title
    ? titled.title
    : "";
  const noteBlockText = stripExplicitTitleFromBlock(sourceBlockText || sourceLine, explicitTitle, i2n);
  /* Правило выбирается **один раз**: и шаблон, и папка берутся у него, иначе
     два прохода однажды разойдутся и заметка уедет не туда (10.13.8 Н5). */
  const smartRule = selectSmartRule(parsed, i2n.smartRules, cfg);
  const target = await pickTargetPath(plugin, title, i2n, smartRule);
  /* Типы свойств из хранилища: список остаётся списком, даже если значение
     одно (B21, решение заказчика 2026-09-02). */
  const yamlMap = buildYamlMapFromContext(transformContext, cfg, readVaultPropertyTypes(plugin && plugin.app));
  const templatePath = String(smartRule && smartRule.targetTemplate || "").trim()
    || String(i2n.defaultTemplate || "").trim();
  const templateContent = target.mode === "add_to_note" && target.exists
    ? ""
    : await readTemplateContent(plugin, templatePath);
  const { yamlLines, body, newline } = parseFrontmatter(templateContent);
  const mergedYaml = renderYamlBlockWithOrder(yamlLines, yamlMap, cfg);
  /*
   * Чей `placement` работает — общий или правила (З-5). Спрашивается **один
   * раз**, и дальше едет с этим ответом: три места, каждое со своим
   * «а если правило молчит», разошлись бы молча (У-32).
   */
  const placementSource = resolvePlacementSource(i2n, smartRule);
  const bodyOut = composeBodyWithPlacement(body, noteBlockText, placementSource, newline);
  const yamlBlock = mergedYaml.length ? `---${newline}${mergedYaml.join(newline)}${newline}---${newline}` : "";
  const noteContent = `${yamlBlock}${bodyOut}`;
  const appendBlock = composeAppendBlock(noteBlockText, placementSource);
  assertEditorSnapshot(plugin, ed, selectionInfo, sourceSnapshot);
  const mutation = await writeInline2Note(plugin, target, noteContent, appendBlock, placementSource);
  const actualTarget = mutation.target;
  try {
    assertEditorSnapshot(plugin, ed, selectionInfo, sourceSnapshot);
    const cleanupFieldIds = resolveSourceCleanupFieldIds(i2n, cfg);
    /* Устройство строки после уборки решается один раз и едет с ней: заново
       его не вывести (замечание заказчика по T4, 2026-09-07). */
    const cleanupPlan = planSourceCleanup(sourceLine, transformContext, cleanupFieldIds, separators);
    const shape = { payloadFirst: cleanupPlan.payloadFirst };
    let nextRoot = cleanupPlan.line;
    nextRoot = applySourcePrefixResolution(nextRoot, sourceLine, transformContext, cleanupFieldIds, cfg, runtimeOptions && runtimeOptions.lineFinalize);
    /* Ссылка и судьба текста решаются вместе, одной записью строки. */
    nextRoot = applySourceTextFate(nextRoot, deriveSourceWikilinkFromTargetPath(actualTarget.path), separators, {
      text: i2n.sourceProcessing.text,
      keepWords: i2n.sourceProcessing.keepWords,
      link: i2n.sourceProcessing.replaceWithLink,
      explicitTitle,
      titleWords,
      i2n,
      shape,
    });
    nextRoot = insertProcessedToken(nextRoot, i2n.sourceProcessing.token, i2n.sourceProcessing.panel, separators, shape);
    replaceEditorSourceBlock(ed, selectionInfo, nextRoot, i2n.sublines);
  } catch (sourceError) {
    try {
      await mutation.rollback();
    } catch (rollbackError) {
      throw new Error(`source edit failed and target rollback failed: ${sourceError.message}; rollback: ${rollbackError.message}`);
    }
    throw new Error(`source edit failed; target mutation rolled back: ${sourceError && sourceError.message ? sourceError.message : sourceError}`);
  }
  if (i2n.openTarget) {
    try {
      const opened = plugin.app.vault.getAbstractFileByPath(actualTarget.path);
      if (opened && plugin.app.workspace && typeof plugin.app.workspace.getLeaf === "function") {
        const leaf = plugin.app.workspace.getLeaf(true);
        if (leaf && typeof leaf.openFile === "function") await leaf.openFile(opened);
      }
    } catch (_) {}
  }
  plugin.notice(__say(__noticeKey("transform", "created"), "Note created: {0}", actualTarget.path));
}

module.exports = {
  DEFAULT_INLINE2NOTE,
  /* Список шаблонов из vault. Вынесен наружу 2026-08-29: блок Smart Rules
     показывает те же шаблоны, что выбирает сам движок, и второй такой же
     фильтр по папке разошёлся бы с ним на первой правке (П9 по смыслу). */
  collectTemplateOptions,
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
  /* Откуда название и какой кусок строки им стал: один ответ на оба вида
     имени, и спрашивают его движок, предпросмотр и проверки (У-32). */
  resolveAutoTitleInfo,
  /* Явное имя в скобках: читают его здесь, а снимают со строки в двух местах
     — правило одно, и объявлено оно один раз (У-32). */
  explicitTitleOf,
  splitByExplicitTitle,
  splitByTitleWords,
  splitByTitleSource,
  stripExplicitTitleFromLine,
  stripExplicitTitleFromBlock,
  /* Метки элементов и длина хвоста у каждой; показательное значение по тому
     же формату — им пользуется и редактор Fields. */
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
  /* Положение `At custom header` (З-4): проверка зовёт те же функции, что и
     движок, а не повторяет то, что они делают (У-4). */
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
  /* Шов между конфигом и заметкой. Отдан наружу ради одной проверки: без
     неё «настройка не доехала до записи» не краснеет нигде (У-56). */
  writeInline2Note,
  deriveSourceWikilinkFromTargetPath,
  runInline2Note,
};
