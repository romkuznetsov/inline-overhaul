/**
 * Вёрстка Smart Rules (PRD 10.8, фаза 3c).
 *
 * Только DOM: ни `Modal`, ни `Notice`, ни движка. Диалог выбора значения
 * открывает тот, кто знает платформу (`smart_rules.ts`), и ответ приходит
 * обратным вызовом — так же устроен редактор Fields, и по той же причине:
 * вёрстка обязана рисоваться на заглушке (гейт Г16).
 *
 * Что здесь важно про смысл, а не про пиксели:
 *
 *   * **Порядок значим.** Правила читаются сверху вниз, срабатывает первое
 *     подходящее (С-6). Поэтому у карточки есть номер и ручка перетаскивания,
 *     а не только галочка.
 *   * **ИЛИ внутри типа, И между типами** — свойство движка, а не настройка
 *     (С-7). Подписи `or` и `and` в строках условий — слова, объясняющие это,
 *     и ни одна из них не нажимается. Выбор соединения внутри типа придёт
 *     фазой 5.
 *   * **Спор правил считает движок.** Карточка показывает то, что вернула
 *     `validateSmartRules`, и не судит сама.
 */

import type { El, ElInput, DragEv } from "./dom.ts";
import { el, btn, selectInput, textInput } from "./dom.ts";
import type { RuleKind, RuleRow, RulesModel } from "./smart_rules_model.ts";
import { RULE_KINDS } from "./smart_rules_model.ts";

/* ---- тексты: сняты с прототипа (Приложение B, 10.8) -------------------- */

/** Подпись строки условий. Тип Field, а не имя ключа конфига. */
const KIND_LABEL: Record<RuleKind, string> = {
  tags: "Tag",
  emojiFields: "Element",
  wikilinks: "Link",
};

const RULE_NAME_PLACEHOLDER = "Name this rule (optional)";
/** Имя пустое — правило зовётся по своему месту в очереди (С-3). */
const RULE_FALLBACK = "Rule ";
/** У типа нет условий — правило не смотрит на него вовсе. */
const KIND_ANY = "any";
const ADD_RULE = "Add rule";
const TEMPLATE_LEAD = "use";
const TEMPLATE_NONE = "None";
/** Пустой список: правил нет, и это приглашение, а не ошибка (ПЗ2, ПЗ3). */
const EMPTY_RULES = "no rules yet — the default template is used for every line";

/**
 * Слово между значениями. Внутри типа — `or`, потому что движок берёт любое
 * из них; между типами — `and`, потому что нужны все названные типы (С-7).
 */
const OP_OR = "or";
const OP_AND = "and";
/** Строка над условиями: как читать, что в них написано. */
const CONDS_LEAD = "when the line has";

export interface RulesViewOpts {
  model: RulesModel;
  /** Модуль выключен: вёрстка показывается, но ничего не меняет. */
  enabled: boolean;
  /** Шаблоны из vault: имя файла и есть значение. */
  templates: readonly string[];
  redraw: () => void;
  /**
   * Спросить значение условия. Окно рисует панель: `Modal` принадлежит
   * платформе, а блок про неё знать не должен. `null` — человек отказался.
   */
  askCondition: (kind: RuleKind, done: (value: string | null) => void) => void;
}

/** Номер правила и его имя: по имени человек его и зовёт. */
function ruleTitle(row: RuleRow, index: number): string {
  return row.name || RULE_FALLBACK + (index + 1);
}

/**
 * Строка условий одного типа: подпись, значения и кнопка `+`. Значения
 * перечислены через `or`, и это подпись, а не контрол.
 */
function kindRow(host: El, row: RuleRow, kind: RuleKind, o: RulesViewOpts): void {
  const values = row.conditions[kind];
  const box = el(host, "div", "io-kind" + (values.length ? "" : " io-kind--empty"));
  el(box, "div", "io-kind__label", KIND_LABEL[kind]);

  const chips = el(box, "div", "io-kind__chips");
  if (!values.length) el(chips, "span", "io-kind__none", KIND_ANY);
  values.forEach((value, i) => {
    if (i) el(chips, "span", "io-op", OP_OR);
    const chip = el(chips, "span", "io-vchip", value);
    const drop = btn(chip, "io-icon", {
      text: "✕",
      label: "Remove " + value + " from " + ruleTitle(row, 0),
    });
    drop.disabled = !o.enabled;
    drop.addEventListener("click", (() => {
      if (!o.enabled) return;
      o.model.removeCondition(row.id, kind, value);
      o.redraw();
    }) as never);
  });

  const add = btn(box, "io-icon", {
    text: "+",
    label: "Add a " + KIND_LABEL[kind].toLowerCase() + " to " + ruleTitle(row, 0),
  });
  add.disabled = !o.enabled;
  add.addEventListener("click", (() => {
    if (!o.enabled) return;
    o.askCondition(kind, value => {
      if (!value) return;
      o.model.addCondition(row.id, kind, value);
      o.redraw();
    });
  }) as never);
}

/** Одна карточка правила. */
function ruleCard(host: El, row: RuleRow, index: number, o: RulesViewOpts, drag: {
  onMove: (from: number, to: number) => void;
  taken: { index: number | null };
}): void {
  const card = el(host, "div", "io-rule"
    + (row.enabled ? "" : " io-rule--off")
    + (row.conflict ? " io-rule--clash" : ""));
  el(card, "div", "io-rule__rail");
  const main = el(card, "div", "io-rule__main");

  const head = el(main, "div", "io-rule__head");
  const grip = el(head, "div", "io-grip", "⠿");
  grip.setAttribute("role", "button");
  grip.setAttribute("aria-label", "Drag " + ruleTitle(row, index) + " to reorder it");
  grip.draggable = o.enabled;
  grip.addEventListener("dragstart", ((ev: DragEv) => {
    drag.taken.index = index;
    card.classList.add("io-dragging");
    try { ev.dataTransfer?.setData("text/plain", row.id); } catch { /* десктоп всегда даёт dataTransfer */ }
  }) as never);
  grip.addEventListener("dragend", (() => {
    drag.taken.index = null;
    card.classList.remove("io-dragging");
  }) as never);
  card.addEventListener("dragover", ((ev: DragEv) => {
    if (drag.taken.index === null) return;
    ev.preventDefault();
    card.classList.add("io-dragover");
  }) as never);
  card.addEventListener("dragleave", (() => { card.classList.remove("io-dragover"); }) as never);
  card.addEventListener("drop", ((ev: DragEv) => {
    ev.preventDefault();
    card.classList.remove("io-dragover");
    const from = drag.taken.index;
    drag.taken.index = null;
    if (from === null || from === index) return;
    drag.onMove(from, index);
  }) as never);

  el(head, "span", "io-rule__n", String(index + 1));

  const name: ElInput = textInput(head, "io-rule__name", {
    value: row.name,
    placeholder: RULE_NAME_PLACEHOLDER,
    label: "Name of " + ruleTitle(row, index),
  });
  name.disabled = !o.enabled;
  name.addEventListener("change", (() => {
    if (!o.enabled) return;
    o.model.setName(row.id, name.value);
    o.redraw();
  }) as never);

  const tools = el(head, "div", "io-rule__tools");
  /*
   * Выключенное правило остаётся на месте и остаётся видимым: человек его
   * выключил, а не удалил, и порядок остальных от этого не меняется.
   */
  const use = btn(tools, "io-icon" + (row.enabled ? " io-icon--on" : ""), {
    text: row.enabled ? "◉" : "○",
    label: (row.enabled ? "Stop using " : "Use ") + ruleTitle(row, index),
  });
  use.disabled = !o.enabled;
  use.addEventListener("click", (() => {
    if (!o.enabled) return;
    o.model.setEnabled(row.id, !row.enabled);
    o.redraw();
  }) as never);

  const remove = btn(tools, "io-icon", {
    text: "✕",
    label: "Remove " + ruleTitle(row, index),
  });
  remove.disabled = !o.enabled;
  remove.addEventListener("click", (() => {
    if (!o.enabled) return;
    o.model.removeRule(row.id);
    o.redraw();
  }) as never);

  const conds = el(main, "div", "io-rule__conds");
  el(conds, "div", "io-rule__lead", CONDS_LEAD);
  RULE_KINDS.forEach((kind, i) => {
    /* Между типами — И, и это сказано словом, а не значком (С-7). */
    if (i) el(conds, "div", "io-op io-op--and io-op--row", OP_AND);
    kindRow(conds, row, kind, o);
  });

  const out = el(main, "div", "io-rule__out");
  el(out, "span", "io-rule__arrow", "→");
  el(out, "span", undefined, TEMPLATE_LEAD);
  const template = selectInput(out, "io-select", {
    options: [{ value: "", label: TEMPLATE_NONE }]
      .concat(o.templates.map(t => ({ value: t, label: t }))),
    value: row.targetTemplate,
    label: "Template for " + ruleTitle(row, index),
  });
  template.disabled = !o.enabled;
  template.addEventListener("change", (() => {
    if (!o.enabled) return;
    o.model.setTemplate(row.id, template.value);
    o.redraw();
  }) as never);

  /* Спор с другим правилом считает движок, а не карточка. */
  if (row.conflict) {
    const warn = el(main, "div", "io-rule__warn");
    el(warn, "span", undefined, "⚠");
    el(warn, "span", undefined, row.conflict);
  }
}

/** Список правил целиком (10.8). */
export function renderSmartRules(host: El, o: RulesViewOpts): void {
  const rows = o.model.listRules();
  const list = el(host, "div", "io-rules");
  const taken: { index: number | null } = { index: null };

  if (!rows.length) el(list, "div", "io-side__empty", EMPTY_RULES);
  rows.forEach((row, i) => ruleCard(list, row, i, o, {
    taken,
    onMove: (from, to) => { o.model.moveRule(from, to); o.redraw(); },
  }));

  const actions = el(host, "div", "io-rowactions");
  const add = btn(actions, "io-btn io-btn--sm io-btn--cta", {
    text: ADD_RULE,
    label: ADD_RULE,
  });
  add.disabled = !o.enabled;
  add.addEventListener("click", (() => {
    if (!o.enabled) return;
    o.model.addRule();
    o.redraw();
  }) as never);
}

/**
 * Тело диалога выбора значения (С-5): сначала Field, потом его Value. Рисуется
 * здесь, а открывается платформой: заглушке `Modal` недоступен, а проверить
 * выбор нужно.
 */
export function renderConditionPicker(host: El, o: {
  kind: RuleKind;
  choices: ReadonlyArray<{ label: string; values: readonly string[] }>;
  pick: (value: string) => void;
}): void {
  const box = el(host, "div", "io-pickvals");
  if (!o.choices.length) {
    el(box, "div", "io-side__empty",
      "no " + KIND_LABEL[o.kind].toLowerCase() + " Fields yet — set one up on the Tags & PKM tab");
    return;
  }
  for (const group of o.choices) {
    const wrap = el(box, "div", "io-pickvals__group");
    el(wrap, "div", "io-pickvals__name", group.label);
    const chips = el(wrap, "div", "io-pickvals__chips");
    if (!group.values.length) {
      el(chips, "span", "io-kind__none", "no Values yet");
      continue;
    }
    for (const value of group.values) {
      const pick = btn(chips, "io-vchip io-vchip--pick", {
        text: value,
        label: "Use " + value + " from " + group.label,
      });
      pick.addEventListener("click", (() => { o.pick(value); }) as never);
    }
  }
}

/** Заголовок диалога: он же объясняет, что выбирается. */
export function conditionDialogTitle(kind: RuleKind): string {
  return "Add a " + KIND_LABEL[kind].toLowerCase();
}

/** Подсказка под заголовком диалога: почему значений может не быть. */
export const CONDITION_DIALOG_NOTE =
  "Pick one of the Values your Fields already offer. A rule looks for any of the Values listed "
  + "under one Field type, and for all of the types you have filled in";

export { KIND_LABEL, OP_AND, OP_OR, RULE_FALLBACK };
