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
import type { RowKind, RuleKind, RuleRow, RulesModel } from "./smart_rules_model.ts";
import { ROW_KINDS } from "./smart_rules_model.ts";
import { templatesEmptyChoice } from "../templates.ts";
import { BLOCK_TEXTS, sayIn } from "../texts_blocks.ts";

/* ---- тексты: сняты с прототипа (Приложение B, 10.8) -------------------- */

/** Подпись строки условий. Тип Field, а не имя ключа конфига. */
const T = BLOCK_TEXTS["smart-rules-list"];

/** Как блок спрашивает свой текст. Нет ctx — ответом идёт английское. */
export type Say = (name: string, ...args: readonly (string | number)[]) => string;
const PLAIN: Say = sayIn("smart-rules-list", {});

const KIND_LABEL: Record<RuleKind, string> = {
  tags: T.KIND_TAG,
  emojiFields: T.KIND_ELEMENT,
  wikilinks: T.KIND_LINK,
  /* Своей строки у Field больше нет; подпись осталась для подписей кнопок. */
  fields: T.KIND_FIELD,
};

/**
 * Хвост чипа условия «любое значение Field» (10.13.7). Условие хранит id
 * Field, а читается оно словами: `Importance — any Value`.
 */
const ANY_VALUE = T.ANY_VALUE_SUFFIX.replace("{0}", "");

/** Имя пустое — правило зовётся по своему месту в очереди (С-3). */
const RULE_FALLBACK = T.RULE_FALLBACK_NAME.replace("{0}", "");
/** У типа нет условий — правило не смотрит на него вовсе. */
/* Папка новой заметки у правила (10.13.8). */
/** Пустой список: правил нет, и это приглашение, а не ошибка (ПЗ2, ПЗ3). */

/**
 * Слово между значениями. Внутри типа — `or`, потому что движок берёт любое
 * из них; между типами — `and`, потому что нужны все названные типы (С-7).
 */
const OP_OR = T.MATCH_OR;
const OP_AND = T.MATCH_AND;
/** Строка над условиями: как читать, что в них написано. */

export interface RulesViewOpts {
  model: RulesModel;
  /** Модуль выключен: вёрстка показывается, но ничего не меняет. */
  enabled: boolean;
  /** Шаблоны из vault: имя файла и есть значение. */
  templates: readonly string[];
  /** Папка, из которой они взяты: нужна подписи пустого списка (1.6.6.2). */
  templatesFolder?: string;
  redraw: () => void;
  /**
   * Спросить значение условия. Окно рисует панель: `Modal` принадлежит
   * платформе, а блок про неё знать не должен. `null` — человек отказался.
   */
  askCondition: (
    kind: RuleKind,
    done: (answer: { kind: "value" | "field"; id: string } | null) => void,
  ) => void;
  /**
   * Повесить на поле подсказчик папок vault. Его даёт панель: класс
   * `AbstractInputSuggest` принадлежит платформе, а вёрстка обязана
   * рисоваться и на заглушке (Г16). Нет подсказчика — поле остаётся обычным
   * полем ввода, и папку можно вписать руками.
   */
  folderSuggest?: (input: ElInput, write: (value: string) => void) => void;
  /** Видимый текст по имени из каталога (10.13.47). */
  say?: Say;
}

/** Номер правила и его имя: по имени человек его и зовёт. */
function ruleTitle(row: RuleRow, index: number): string {
  return row.name || RULE_FALLBACK + (index + 1);
}

/**
 * Строка условий одного типа: подпись, значения и кнопка `+`. Значения
 * перечислены через `or`, и это подпись, а не контрол.
 */
function kindRow(host: El, row: RuleRow, kind: RowKind, o: RulesViewOpts): void {
  const say = o.say || PLAIN;
  /*
   * В строке стоят и значения этого типа, и Fields этого типа целиком —
   * через `or`, одним списком. Отдельной строки `Field` больше нет: заказчик
   * просил «вместо того, чтобы накликивать отдельные values», а прежняя
   * строка соединялась с остальными через `and`, то есть значила обратное
   * (B14, решение 2026-09-03).
   *
   * Field, тип которого неизвестен (его удалили из конфига), не попадает ни в
   * одну строку — и правило он тоже не блокирует, см. `selectSmartRule`.
   */
  const values = row.conditions[kind];
  const fields = row.conditions.fields.filter(id => o.model.fieldRowKind(id) === kind);
  const items: Array<{ shown: string; kind: RuleKind; value: string }> = values
    .map(value => ({ shown: value, kind: kind as RuleKind, value }))
    .concat(fields.map(id => ({
      shown: o.model.fieldLabel(id) + ANY_VALUE,
      kind: "fields" as RuleKind,
      value: id,
    })));

  const box = el(host, "div", "io-kind" + (items.length ? "" : " io-kind--empty"));
  el(box, "div", "io-kind__label", KIND_LABEL[kind]);

  const chips = el(box, "div", "io-kind__chips");
  if (!items.length) el(chips, "span", "io-kind__none", say("MATCH_ANY"));
  items.forEach((item, i) => {
    if (i) el(chips, "span", "io-op", OP_OR);
    const chip = el(chips, "span", "io-vchip", item.shown);
    const drop = btn(chip, "io-icon", {
      text: "✕",
      label: say("CONDITION_REMOVE", item.shown + " from " + ruleTitle(row, 0)),
    });
    drop.disabled = !o.enabled;
    drop.addEventListener("click", (() => {
      if (!o.enabled) return;
      o.model.removeCondition(row.id, item.kind, item.value);
      o.redraw();
    }) as never);
  });

  const add = btn(box, "io-icon", {
    text: "+",
    label: say("ADD_CONDITION", KIND_LABEL[kind].toLowerCase() + " to " + ruleTitle(row, 0)),
  });
  add.disabled = !o.enabled;
  add.addEventListener("click", (() => {
    if (!o.enabled) return;
    o.askCondition(kind, answer => {
      if (!answer || !answer.id) return;
      /*
       * Ветка конфига у «любого значения Field» своя (`conditions.fields`,
       * там лежит id Field, а не токен), а строка — та, из которой открыли
       * окно: окно перечисляет Fields только своего типа, поэтому чип
       * вернётся сюда же (10.13.14 Н5, B14).
       */
      const into: RuleKind = answer.kind === "field" ? "fields" : kind;
      o.model.addCondition(row.id, into, answer.id);
      o.redraw();
    });
  }) as never);
}

/** Одна карточка правила. */
function ruleCard(host: El, row: RuleRow, index: number, o: RulesViewOpts, drag: {
  onMove: (from: number, to: number) => void;
  taken: { index: number | null };
}): void {
  const say = o.say || PLAIN;
  const card = el(host, "div", "io-rule"
    + (row.enabled ? "" : " io-rule--off")
    + (row.conflict ? " io-rule--clash" : ""));
  el(card, "div", "io-rule__rail");
  const main = el(card, "div", "io-rule__main");

  const head = el(main, "div", "io-rule__head");
  const grip = el(head, "div", "io-grip", "⠿");
  grip.setAttribute("role", "button");
  grip.setAttribute("aria-label", say("RULE_DRAG", "Drag " + ruleTitle(row, index)));
  grip.draggable = o.enabled;
  grip.addEventListener("dragstart", ((ev: DragEv) => {
    drag.taken.index = index;
    card.classList.add("io-dragging");
    try { ev.dataTransfer?.setData("text/plain", row.id); } catch { /* проба: десктоп всегда даёт dataTransfer */ }
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
    placeholder: say("RULE_NAME_HINT"),
    label: say("RULE_NAME_ARIA", ruleTitle(row, index)),
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
    label: say(row.enabled ? "RULE_STOP" : "USE_VALUE", ruleTitle(row, index)),
  });
  use.disabled = !o.enabled;
  use.addEventListener("click", (() => {
    if (!o.enabled) return;
    o.model.setEnabled(row.id, !row.enabled);
    o.redraw();
  }) as never);

  const remove = btn(tools, "io-icon", {
    text: "✕",
    label: say("RULE_REMOVE", ruleTitle(row, index)),
  });
  remove.disabled = !o.enabled;
  remove.addEventListener("click", (() => {
    if (!o.enabled) return;
    o.model.removeRule(row.id);
    o.redraw();
  }) as never);

  const conds = el(main, "div", "io-rule__conds");
  el(conds, "div", "io-rule__lead", say("WHEN_THE_LINE_HAS"));
  ROW_KINDS.forEach((kind, i) => {
    /* Между типами — И, и это сказано словом, а не значком (С-7). */
    if (i) el(conds, "div", "io-op io-op--and io-op--row", OP_AND);
    kindRow(conds, row, kind, o);
  });

  const out = el(main, "div", "io-rule__out");
  el(out, "span", "io-rule__arrow", "→");
  el(out, "span", undefined, say("USE_TEMPLATE"));
  /*
   * Пустой список объясняется, а не показывает одно `None`: человек не
   * должен гадать, кончились ли шаблоны или он не назначил папку
   * (замечание заказчика 1.6.6.2). Слова — те же, что у `Default template`.
   */
  const choices = o.templates.length
    ? [{ value: "", label: say("TEMPLATE_NONE") }]
      .concat(o.templates.map(t => ({ value: t, label: t })))
    : [templatesEmptyChoice(String(o.templatesFolder || ""))];
  const template = selectInput(out, "io-select", {
    options: choices,
    value: row.targetTemplate,
    label: say("RULE_TEMPLATE_ARIA", ruleTitle(row, index)),
  });
  template.disabled = !o.enabled;
  template.addEventListener("change", (() => {
    if (!o.enabled) return;
    o.model.setTemplate(row.id, template.value);
    o.redraw();
  }) as never);

  /*
   * Папка новой заметки (10.13.8). Один список на три случая: `Default` —
   * как `New notes folder`, `Near current note` — рядом с текущей заметкой,
   * и своя папка. Своя папка открывает поле рядом: подсказчик папок Obsidian
   * живёт в панели, а вёрстка обязана рисоваться и без него.
   */
  const where = el(main, "div", "io-rule__out io-rule__where");
  el(where, "span", "io-rule__arrow", "\u2192");
  el(where, "span", undefined, say("MOVE_TO_FOLDER"));
  const folderPick = selectInput(where, "io-select", {
    options: [
      { value: "default", label: say("FOLDER_DEFAULT") },
      { value: "near", label: say("FOLDER_NEAR_NOTE") },
      { value: "folder", label: say("FOLDER_OTHER") },
    ],
    value: row.folderMode,
    label: say("MOVE_TO_FOLDER") + " for " + ruleTitle(row, index),
  });
  folderPick.disabled = !o.enabled;
  folderPick.addEventListener("change", (() => {
    if (!o.enabled) return;
    o.model.setFolder(row.id, folderPick.value as never, row.folder);
    o.redraw();
  }) as never);

  if (row.folderMode === "folder") {
    const path: ElInput = textInput(where, "io-text io-text--mono", {
      value: row.folder,
      placeholder: say("FOLDER_HINT"),
      label: say("RULE_FOLDER_ARIA", say("MOVE_TO_FOLDER"), ruleTitle(row, index)),
    });
    path.disabled = !o.enabled;
    const writeFolder = (value: string): void => {
      if (!o.enabled) return;
      o.model.setFolder(row.id, "folder", value);
      o.redraw();
    };
    if (o.folderSuggest) o.folderSuggest(path, writeFolder);
    path.addEventListener("change", (() => { writeFolder(path.value); }) as never);
  }

  /* Спор с другим правилом считает движок, а не карточка. */
  if (row.conflict) {
    const warn = el(main, "div", "io-rule__warn");
    el(warn, "span", undefined, "⚠");
    el(warn, "span", undefined, row.conflict);
  }
}

/** Список правил целиком (10.8). */
export function renderSmartRules(host: El, o: RulesViewOpts): void {
  const say = o.say || PLAIN;
  const rows = o.model.listRules();
  const list = el(host, "div", "io-rules");
  const taken: { index: number | null } = { index: null };

  if (!rows.length) el(list, "div", "io-side__empty", say("RULES_EMPTY"));
  rows.forEach((row, i) => ruleCard(list, row, i, o, {
    taken,
    onMove: (from, to) => { o.model.moveRule(from, to); o.redraw(); },
  }));

  const actions = el(host, "div", "io-rowactions");
  const add = btn(actions, "io-btn io-btn--sm io-btn--cta", {
    text: say("ADD_RULE"),
    label: say("ADD_RULE"),
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
  choices: ReadonlyArray<{ label: string; fieldId?: string; values: readonly string[] }>;
  pick: (value: string) => void;
  /**
   * Завести условие «любое значение этого Field» (10.13.14). Отсутствует —
   * имя Field остаётся подписью, как было: это тот же тихий отказ, что у
   * подсказчика папок.
   */
  pickField?: (fieldId: string) => void;
  /** Fields, у которых такое условие в правиле уже есть: их имя неактивно. */
  fieldsTaken?: readonly string[];
  /** Видимый текст по имени из каталога (10.13.47). */
  say?: Say;
}): void {
  const say = o.say || PLAIN;
  const box = el(host, "div", "io-pickvals");
  if (!o.choices.length) {
    el(box, "div", "io-side__empty", o.kind === "fields"
      ? "no Fields yet — set one up on the Tags & PKM tab"
      : say("NO_KIND_FIELDS_YET", KIND_LABEL[o.kind].toLowerCase()));
    return;
  }
  const taken = new Set((o.fieldsTaken || []).map(x => String(x || "").trim()));
  for (const group of o.choices) {
    const wrap = el(box, "div", "io-pickvals__group");
    /*
     * Имя Field — кнопка: нажатие заводит условие «любое значение этого
     * Field» и закрывает окно (10.13.14, замечание заказчика B14 от
     * 2026-09-02). Раньше имя было подписью, и Field целиком заводился только
     * через отдельную строку `Field` — заказчик просил другой способ
     * добавления, а не другой способ показа, поэтому строка осталась.
     *
     * Условие уже заведено — имя неактивно: повтор ничего не меняет в
     * правиле, а нажатие, которое ничего не делает, хуже отсутствия кнопки
     * (З8).
     */
    const fieldId = String(group.fieldId || "").trim();
    if (o.pickField && fieldId) {
      const already = taken.has(fieldId);
      const name = btn(wrap, "io-pickvals__name io-pickvals__name--pick", {
        text: group.label,
        label: already
          ? say("ANY_VALUE_TAKEN", group.label)
          : say("USE_ANY_VALUE_OF", group.label),
      });
      name.disabled = already;
      if (!already) {
        const take = o.pickField;
        name.addEventListener("click", (() => { take(fieldId); }) as never);
      }
    } else {
      el(wrap, "div", "io-pickvals__name", group.label);
    }
    const chips = el(wrap, "div", "io-pickvals__chips");
    if (!group.values.length) {
      el(chips, "span", "io-kind__none", "no Values yet");
      continue;
    }
    for (const value of group.values) {
      const pick = btn(chips, "io-vchip io-vchip--pick", {
        text: value,
        label: say("USE_VALUE", value + " from " + group.label),
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
