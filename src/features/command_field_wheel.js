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
/* Признак синтетического Field колеса: по нему его находят Enter и уборка. */
const KIND = "command";

/**
 * Вход колеса из конфига: что вставить и куда, плюс `apply` на этом же
 * конфиге. Только `Active: Yes` и только Left/Right; custom block — позже.
 */
function wheelInput(cfg) {
  const order = __orderConfig.normalizePkmOrder(cfg && cfg.pkm && cfg.pkm.fields ? cfg.pkm.fields.order : null);
  const fieldName = (k) => String(order.strictNames[k] || k);
  const fields = [];
  for (const side of ["left", "right"]) {
    const list = order[side] || [];
    list.forEach((key, i) => {
      if (order.types[key] !== "command" || (order.active[key] || "yes") !== "yes") return;
      const categories = __commandField.fieldCategories(cfg, key).filter((c) => !c.hidden).map((c) => {
        const reg = __commandField.categoryById(c.id);
        const presets = [];
        c.presets.forEach((p, index) => {
          if (!p.hidden) presets.push({ index, name: String(p.name || "").trim() || reg.defaultName(p, fieldName) });
        });
        return { key: c.key, name: c.name, presets };
      }).filter((c) => c.presets.length);
      fields.push({
        key, side, after: i ? list[i - 1] : "",
        label: String(order.labels[key] || "").trim() || fieldName(key),
        categories,
      });
    });
  }
  return {
    fields,
    apply: (editor, key, categoryKey, presetIndex) =>
      __commandField.applyPresetInEditor(editor, cfg, key, categoryKey, presetIndex),
  };
}

/**
 * Вставить Command Field в правила колеса: родитель — категории, ребёнок —
 * пресеты с `parentIsNavigator`. Зовётся после разбора строки, поэтому разбор
 * Values Command Field в строке не ищет.
 */
function inject(rules, input) {
  if (!input || !Array.isArray(input.fields)) return;
  const order = rules.behavior.order || (rules.behavior.order = {});
  for (const f of input.fields) {
    const mode = f.side === "left" ? rules.leftMode : rules.rightMode;
    const opts = {};
    mode.fields.push(__normalizer.normalizeField({
      id: f.key, orderKey: f.key, prefix: "", kind: KIND, placeholder: f.label,
      values: f.categories.map((c) => ({ id: c.name, token: c.name })),
    }, f.side, 0, opts));
    mode.fields.push(__normalizer.normalizeField({
      id: f.key + SUB, orderKey: f.key + SUB, prefix: "", kind: KIND, dependsOn: f.key, parentIsNavigator: true,
      /* Ячейка пресетов называется по уровню, как `sub` у дочернего Field. */
      placeholder: "preset",
      values: [].concat(...f.categories.map((c) => c.presets.map((p) => ({ id: c.key + "/" + p.index, token: p.name, allowedParentValues: [c.name] })))),
    }, f.side, 0, opts));
    const list = Array.isArray(order[f.side]) ? order[f.side] : (order[f.side] = []);
    const at = f.after ? list.indexOf(f.after) : -1;
    list.splice(at + 1, 0, f.key);
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
 * `Enter` на ячейке Command Field: снять полосу (`cancel`) и применить пресет;
 * выбрана только категория — её первый видимый пресет (4.4). `false` — ячейка
 * не его, колесо ведёт себя как обычно.
 */
function enter(state, cancel) {
  const fid = String(state.session.activeFieldId || "");
  const field = [].concat(state.rules.leftMode.fields, state.rules.rightMode.fields).find((f) => f.id === fid);
  if (!isCommandField(field)) return false;
  const key = fid.endsWith(SUB) ? fid.slice(0, -SUB.length) : fid;
  const input = state.commandFields;
  const own = input && input.fields.find((f) => f.key === key);
  const pick = String(state.session.selected[key + SUB] || "");
  const catName = String(state.session.selected[key] || "");
  let target = null;
  if (own && pick) {
    const slash = pick.lastIndexOf("/");
    target = { category: pick.slice(0, slash), index: Number(pick.slice(slash + 1)) };
  } else if (own && catName) {
    const c = own.categories.find((x) => x.name === catName);
    if (c) target = { category: c.key, index: c.presets[0].index };
  }
  cancel(state);
  if (target) input.apply(state.editor, key, target.category, target.index);
  return true;
}

module.exports = { wheelInput, inject, clearSelections, enter, isCommandField };
