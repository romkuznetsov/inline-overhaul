"use strict";

/**
 * Command Field в tagWheel (постановка `test-vault/command-field.md`, 4.5; его
 * `💬` к тесту 1 цикла 125: «в tagwheel не появились field=command»).
 *
 * Правила строки Command Field не видят (`withoutCommandFields`, № 198), поэтому
 * колесо получает его отдельным входом — только командами tagWheel. Ячейка —
 * категории (навигатор, в строку не пишется), дочерняя ячейка — пресеты;
 * `Enter` на них снимает полосу и применяет пресет одной транзакцией.
 */

const __normalizer = require("../core/tagwheel_rules_normalizer.js");
const __orderConfig = require("../core/pkm_order_config.js");
const __commandField = require("./command_field.js");

const SUB = "_sub";
/* Снимок выбора при открытии — ключ в сессии колеса. */
const OPENED = "__ioOpenedSelection";
/* Признак синтетического Field колеса: по нему его находят Enter и уборка. */
const KIND = "command";

/**
 * Вход колеса из конфига: что вставить и куда, плюс `apply` на этом же
 * конфиге. Только `Active: Yes`; у Field из custom block — `block`, сторона Left.
 */
function wheelInput(cfg) {
  const order = __orderConfig.normalizePkmOrder(cfg && cfg.pkm && cfg.pkm.fields ? cfg.pkm.fields.order : null);
  const fieldName = (k) => String(order.strictNames[k] || k);
  const fields = [];
  const places = [{ side: "left", list: order.left }, { side: "right", list: order.right }]
    .concat((order.custom || []).map((b) => ({ side: "left", list: b.keys, block: b.id })));
  for (const { side, list: listRaw, block } of places) {
    const list = listRaw || [];
    list.forEach((key, i) => {
      if (order.types[key] !== "command" || (order.active[key] || "yes") !== "yes") return;
      const categories = __commandField.fieldCategories(cfg, key).filter((c) => !c.hidden).map((c) => {
        const reg = __commandField.categoryById(c.id);
        const presets = [];
        /* Совпавший клон в скроллере не виден, как скрытый (его `💬` к тесту 3 цикла 125, В-281). */
        const seen = new Set();
        c.presets.forEach((p, index) => {
          if (p.hidden || seen.has(reg.signature(p))) return;
          seen.add(reg.signature(p));
          presets.push({ index, name: String(p.name || "").trim() || reg.defaultName(p, fieldName) });
        });
        return {
          id: c.id, key: c.key, name: c.name, presets,
          /* Какой пресет стоит под кареткой; у категории без результата (Очистка) — никакой. */
          recognize: (ctx) => (typeof reg.recognize === "function" ? reg.recognize(ctx, c.presets) : -1),
        };
      }).filter((c) => c.presets.length);
      fields.push({
        key, side, block: block || "", after: i ? list[i - 1] : "",
        label: String(order.labels[key] || "").trim() || fieldName(key),
        /* `Child name in tagWheel` — подпись ячейки пресетов, без него `preset`. */
        subLabel: String(order.labels[key + SUB] || "").trim() || "preset",
        categories,
      });
    });
  }
  return {
    fields,
    apply: (editor, key, categoryKey, presetIndex) =>
      __commandField.applyPresetInEditor(editor, cfg, key, categoryKey, presetIndex),
    revert: (editor, key, categoryKey) => __commandField.revertInEditor(editor, cfg, key, categoryKey),
  };
}

/**
 * Вставить Command Field в правила колеса: родитель — категории, ребёнок —
 * пресеты с `parentIsNavigator`. Зовётся после разбора строки, поэтому разбор
 * Values Command Field в строке не ищет. `block` — id custom block, пусто —
 * Left/Right. Повторный вызов на тех же правилах (`Tab` по кругу) ничего не делает.
 */
function inject(rules, input, block) {
  if (!input || !Array.isArray(input.fields)) return;
  const order = rules.behavior.order || (rules.behavior.order = {});
  for (const f of input.fields) {
    if ((f.block || "") !== (block || "")) continue;
    const mode = f.side === "left" ? rules.leftMode : rules.rightMode;
    if (mode.fields.some((x) => x.id === f.key)) continue;
    const opts = {};
    mode.fields.push(__normalizer.normalizeField({
      id: f.key, orderKey: f.key, prefix: "", kind: KIND, placeholder: f.label,
      values: f.categories.map((c) => ({ id: c.name, token: c.name })),
    }, f.side, 0, opts));
    mode.fields.push(__normalizer.normalizeField({
      id: f.key + SUB, orderKey: f.key + SUB, prefix: "", kind: KIND, dependsOn: f.key, parentIsNavigator: true,
      placeholder: f.subLabel || "preset",
      /* Один пресет — ячейки пресетов у категории нет: её выбор и есть пресет (его `💬` к тесту 2 цикла 125). */
      values: [].concat(...f.categories.filter((c) => c.presets.length > 1)
        .map((c) => c.presets.map((p) => ({ id: c.key + "/" + p.index, token: p.name, allowedParentValues: [c.name] })))),
    }, f.side, 0, opts));
    const list = Array.isArray(order[f.side]) ? order[f.side] : (order[f.side] = []);
    const at = f.after ? list.indexOf(f.after) : -1;
    list.splice(at + 1, 0, f.key);
  }
}

/**
 * Колесо открыто в результате категории (в коллауте) — её пресет выбран сразу,
 * как Value обычного Field (его `💬` к тесту 1 цикла 125). Зовётся после разбора строки.
 */
function hydrate(session, input, editor, block) {
  const own = input && Array.isArray(input.fields) ? input.fields.filter((f) => (f.block || "") === (block || "")) : [];
  /* Command Field нет — документ не читается вовсе; редактор без `getValue` — проба, «нет» — ответ. */
  if (!own.length) return;
  /* Выбор Values при открытии: Enter пишет строку, только если его меняли (иначе пустая строка получила бы `- `). */
  session[OPENED] = Object.assign({}, session.selected);
  if (!editor || typeof editor.getValue !== "function") return;
  const ctx = { lines: String(editor.getValue()).split("\n"), cursor: editor.getCursor() };
  for (const f of own) {
    for (const c of f.categories) {
      const index = c.recognize(ctx);
      const preset = c.presets.find((p) => p.index === index);
      if (!preset) continue;
      session.selected[f.key] = c.name;
      if (c.presets.length > 1) session.selected[f.key + SUB] = c.key + "/" + preset.index;
      break;
    }
  }
}

function isCommandField(field) {
  return !!field && field.kind === KIND;
}

/** Выбор в Command Field на строку не пишется никогда: снимается перед записью. */
function clearSelections(rules, session) {
  for (const f of [].concat(rules.leftMode.fields, rules.rightMode.fields)) {
    if (isCommandField(f)) session.selected[f.id] = "";
  }
}

/**
 * Что сделать одному Command Field по его выбору: `{ field, category, index }`
 * (применить пресет), `{ field, category }` (снять результат) или `null`.
 * Пустое значение — результата нет (его `💬` к тесту 1 цикла 125, «универсальное
 * правило»): снимается выбранная категория, без неё — та, в чьём результате
 * каретка. У категории с одним пресетом её выбор и есть пресет.
 */
function planOf(f, selected, ctx) {
  const pick = String(selected[f.key + SUB] || "");
  const chosen = f.categories.find((x) => x.name === String(selected[f.key] || ""));
  if (pick) {
    const slash = pick.lastIndexOf("/");
    const category = f.categories.find((c) => c.key === pick.slice(0, slash));
    return category ? { field: f, category, index: Number(pick.slice(slash + 1)) } : null;
  }
  if (chosen && chosen.presets.length === 1) return { field: f, category: chosen, index: chosen.presets[0].index };
  const undo = chosen || f.categories.find((c) => c.recognize(ctx) >= 0);
  return undo ? { field: f, category: undo } : null;
}

/**
 * `Enter` в полосе с Command Field — всё выбранное разом (его ответ 2026-10-03
 * «Enter делает всё»): менявшиеся Values пишутся своей дорогой записи строки
 * (`write`, она снимает выбор Command Field), нет — полоса снимается (`cancel`); затем применяется выбор каждого Command Field
 * (его пункт «Новое»: выбрал Cleanup и коллаут — применился один). Решения — по
 * тексту до правок пресетов: иначе коллаут, поставленный первым, второй Field
 * прочёл бы как свой и снял. Порядок — полосы. `false` — Command Field в полосе нет.
 */
function enter(state, cancel, write) {
  const all = [].concat(state.rules.leftMode.fields, state.rules.rightMode.fields);
  const input = state.commandFields;
  const own = input ? input.fields.filter((f) => all.some((x) => x.id === f.key)) : [];
  if (!own.length) return false;
  const selected = Object.assign({}, state.session.selected);
  /* Без снимка (соседний custom block по `Tab`) — менялся тот, у кого что-то выбрано. */
  const opened = state.session[OPENED] || {};
  const changed = all.some((f) => !isCommandField(f) && String(selected[f.id] || "") !== String(opened[f.id] || ""));
  if (changed) write(state, state.core); else cancel(state);
  const ctx = { lines: String(state.editor.getValue()).split("\n"), cursor: state.editor.getCursor() };
  const plans = own.map((f) => planOf(f, selected, ctx)).filter(Boolean);
  for (const p of plans) {
    const got = p.index != null ? input.apply(state.editor, p.field.key, p.category.key, p.index)
      : input.revert(state.editor, p.field.key, p.category.key);
    /* Неприменимая команда не прячется — текст не меняется, причина вслух (4.5); `Notice` — как у tagWheel. */
    if (got && got.refuse && typeof globalThis.Notice === "function") {
      new globalThis.Notice(__commandField.refusalText(got, p.field.label + " · " + p.category.name));
    }
  }
  return true;
}

module.exports = { wheelInput, inject, hydrate, clearSelections, enter, isCommandField };
