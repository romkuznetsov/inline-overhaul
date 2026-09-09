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
import type { RowKind, RuleKind, RulePlacement, RuleRow, RulesModel } from "./smart_rules_model.ts";
import { ROW_KINDS } from "./smart_rules_model.ts";
import { templateLabel, templatesEmptyChoice } from "../templates.ts";
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
  /**
   * Развёрнутые карточки (З-6). **Состояние вида, и в конфиг оно не пишется**
   * (О0): хранить в настройках человека, открыта ли карточка, значило бы
   * записывать туда вид панели. Живёт оно в замыкании блока — так же, как
   * выбранный Field у редактора Fields, — и переживает перерисовку, которой
   * отвечает на каждое нажатие сам блок.
   *
   * Нет набора — карточки развёрнуты все: так вёрстка ведёт себя на заглушке
   * и в старых проверках, где ей никакого состояния не передают.
   */
  expanded?: Set<string>;
}

/** Номер правила и его имя: по имени человек его и зовёт. */
function ruleTitle(row: RuleRow, index: number): string {
  return row.name || RULE_FALLBACK + (index + 1);
}

/**
 * Что стоит в строке условий этого типа: значения и Fields целиком.
 *
 * Одно объявление на два места — саму строку и сводку свёрнутой карточки
 * (З-6). Второй такой же сбор разошёлся бы с первым молча (У-32): человек
 * увидел бы в свёрнутом виде не то, что развернул бы нажатием.
 */
function conditionItems(
  row: RuleRow,
  kind: RowKind,
  o: RulesViewOpts,
): Array<{ shown: string; kind: RuleKind; value: string }> {
  const values = row.conditions[kind];
  const fields = row.conditions.fields.filter(id => o.model.fieldRowKind(id) === kind);
  return values
    .map(value => ({ shown: value, kind: kind as RuleKind, value }))
    .concat(fields.map(id => ({
      shown: o.model.fieldLabel(id) + ANY_VALUE,
      kind: "fields" as RuleKind,
      value: id,
    })));
}

/**
 * Что стоит в сводке свёрнутой карточки: у каждой части подпись и значение.
 *
 * Заказчик назвал состав сам: «название, что выбрано в `when the line has`,
 * используемый template, папка назначения» — плюс управление, а оно и так
 * стоит в шапке и никуда не девается. Имя здесь не повторяется: оно в шапке,
 * строкой выше.
 *
 * **Подписи появились по его замечанию 2026-09-09:** «мне не нравится, что в
 * свёрнутом состоянии во второй строке сжатая информация даётся слишком
 * скудно… сделай, чтобы было `Use when: #todo` | `Template: template1.md` |
 * `Folder: 333`». Прежде три значения стояли подряд через точку, и `333` ничем
 * не отличалось от имени шаблона: догадаться, что из них папка, можно было
 * только развернув карточку — то есть ровно тем действием, ради экономии
 * которого сводка и заведена.
 *
 * Состав собран отдельно от отрисовки нарочно: **что** сказано — решение, и
 * его проверяет набор; **как** оно разложено по узлам — вёрстка.
 */
/**
 * Имя шаблона на экране. Правило одно и живёт в `templates.ts`: и список
 * `Use template`, и сводка свёрнутой карточки называют шаблон так же, как его
 * называет `Default template` (замечание по S6, 2026-09-09).
 *
 * В конфиге при этом остаётся путь целиком: имя — то, что человек читает, а не
 * то, что записано.
 */
function templateName(path: string, o: RulesViewOpts): string {
  return templateLabel(String(o.templatesFolder || ""), path);
}

function summaryParts(row: RuleRow, o: RulesViewOpts): Array<{ label: string; value: string }> {
  const say = o.say || PLAIN;
  const shown = ROW_KINDS.flatMap(kind => conditionItems(row, kind, o).map(x => x.shown));
  return [
    {
      label: say("SUMMARY_WHEN"),
      value: shown.length ? shown.join(", ") : say("SUMMARY_ANY_LINE"),
    },
    {
      label: say("SUMMARY_TEMPLATE"),
      value: row.targetTemplate ? templateName(row.targetTemplate, o) : say("TEMPLATE_NONE"),
    },
    {
      label: say("SUMMARY_FOLDER"),
      value: row.folderMode === "folder"
        ? (row.folder || say("FOLDER_OTHER"))
        : say(row.folderMode === "near" ? "FOLDER_NEAR_NOTE" : "FOLDER_DEFAULT"),
    },
  ];
}

/**
 * \u0421\u0432\u0451\u0440\u043d\u0443\u0442\u0430\u044f \u043a\u0430\u0440\u0442\u043e\u0447\u043a\u0430: \u043e\u0434\u043d\u0430 \u0441\u0442\u0440\u043e\u043a\u0430 \u0441 \u0442\u0435\u043c, \u0440\u0430\u0434\u0438 \u0447\u0435\u0433\u043e \u0447\u0435\u043b\u043e\u0432\u0435\u043a \u0435\u0451 \u043e\u0442\u043a\u0440\u044b\u043b \u0431\u044b (\u0417-6).
 *
 * \u0421\u0447\u0438\u0442\u0430\u0442\u044c \u043d\u0435\u0447\u0435\u0433\u043e \u2014 \u0432\u0441\u0451 \u044d\u0442\u043e \u0443 \u043f\u0440\u0430\u0432\u0438\u043b\u0430 \u0443\u0436\u0435 \u0435\u0441\u0442\u044c; \u0441\u043e\u0431\u0438\u0440\u0430\u0435\u0442\u0441\u044f \u0441\u0442\u0440\u043e\u043a\u0430, \u0438 \u0442\u043e\u043b\u044c\u043a\u043e.
 */
function summaryLine(host: El, row: RuleRow, o: RulesViewOpts): void {
  const box = el(host, "div", "io-rule__summary");
  summaryParts(row, o).forEach((part, i) => {
    /* \u0427\u0435\u0440\u0442\u0430, \u0430 \u043d\u0435 \u0442\u043e\u0447\u043a\u0430: \u0447\u0430\u0441\u0442\u0438 \u0442\u0435\u043f\u0435\u0440\u044c \u043f\u043e\u0434\u043f\u0438\u0441\u0430\u043d\u044b, \u043f\u043e\u0434\u043f\u0438\u0441\u044c \u0441\u043e \u0437\u043d\u0430\u0447\u0435\u043d\u0438\u0435\u043c \u0447\u0438\u0442\u0430\u044e\u0442\u0441\u044f
       \u0432\u043c\u0435\u0441\u0442\u0435, \u0438 \u0440\u0430\u0437\u0434\u0435\u043b\u044f\u0442\u044c \u0438\u0445 \u043d\u0430\u0434\u043e \u0437\u0430\u043c\u0435\u0442\u043d\u0435\u0435, \u0447\u0435\u043c \u0441\u043b\u043e\u0432\u0430 \u0432\u043d\u0443\u0442\u0440\u0438 \u043e\u0434\u043d\u043e\u0439 \u0447\u0430\u0441\u0442\u0438. */
    if (i) el(box, "span", "io-rule__sep", "|");
    const cell = el(box, "span", "io-rule__sumpart");
    el(cell, "span", "io-rule__sumlabel", part.label);
    /*
     * Пробел стоит **в тексте значения**, а не отступом в стилях. Отступ виден
     * глазами и не виден больше никому: в скопированной строке и у программы
     * чтения с экрана подпись слиплась бы со значением — `Use when:#todo`.
     */
    el(cell, "span", "io-rule__sumvalue", " " + part.value);
  });
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
  const items = conditionItems(row, kind, o);

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

/**
 * Своя ветка `Note content` у правила (З-5, заказчик 2026-09-08).
 *
 * Заказчик: «под `move to folder` появилась новая строка `Advanced settings`,
 * при нажатии на которую бы открывались дополнительные опции, по сути
 * дублирующие note-content… По умолчанию должно стоять `default` — т.е.
 * поведение как у note-content».
 *
 * **Открывает опции сам выбор, а не отдельная кнопка.** Строка `Advanced
 * settings` несёт список из двух значений; `Default` — «как в `Note content`»,
 * и это умолчание. Второе состояние (открыто/закрыто) пришлось бы где-то
 * хранить, а хранить его негде: панель перерисовывает блок от любого
 * изменения хранилища, и в памяти вёрстки оно терялось бы на каждом шаге.
 *
 * **Строки те же, что в `Note content`, и появляются они по тем же условиям:**
 * имя заголовка и запасное положение — только при `At custom header`, уровень
 * — когда строка над текстом вообще есть, а текст и формат даты — каждый при
 * своём режиме. Иначе у правила стояли бы контролы, которым нечего решать (З8).
 */
function placementRows(host: El, row: RuleRow, index: number, o: RulesViewOpts): void {
  const say = o.say || PLAIN;
  const p: RulePlacement = row.placement;
  const box = el(host, "div", "io-rule__placement");

  const aria = (name: string): string => say("PL_ROW_ARIA", name, ruleTitle(row, index));

  const line = (label: string): El => {
    const wrap = el(box, "div", "io-rule__plrow");
    el(wrap, "span", "io-rule__pllabel", label);
    return wrap;
  };

  const pick = (
    label: string,
    value: string,
    options: ReadonlyArray<{ value: string; label: string }>,
    write: (next: string) => void,
  ): void => {
    const wrap = line(label);
    const input = selectInput(wrap, "io-select", { options: options.slice(), value, label: aria(label) });
    input.disabled = !o.enabled;
    input.addEventListener("change", (() => {
      if (!o.enabled) return;
      write(input.value);
      o.redraw();
    }) as never);
  };

  const type = (label: string, value: string, hint: string, write: (next: string) => void): void => {
    const wrap = line(label);
    const input = textInput(wrap, "io-text io-text--mono", { value, placeholder: hint, label: aria(label) });
    input.disabled = !o.enabled;
    input.addEventListener("change", (() => {
      if (!o.enabled) return;
      write(input.value);
      o.redraw();
    }) as never);
  };

  pick(say("PL_POSITION"), p.position, [
    { value: "beginning", label: say("PL_POSITION_BEGINNING") },
    { value: "end", label: say("PL_POSITION_END") },
    { value: "custom-header", label: say("PL_POSITION_HEADER") },
  ], next => o.model.setPlacement(row.id, { position: next }));

  if (p.position === "custom-header") {
    type(say("PL_TARGET_HEADER"), p.targetHeader, say("PL_TARGET_HEADER_HINT"),
      next => o.model.setPlacement(row.id, { targetHeader: next }));
    pick(say("PL_FALLBACK"), p.fallback, [
      { value: "beginning", label: say("PL_POSITION_BEGINNING") },
      { value: "end", label: say("PL_POSITION_END") },
    ], next => o.model.setPlacement(row.id, { fallback: next }));
  }

  pick(say("PL_HEADER_MODE"), p.headerMode, [
    { value: "custom", label: say("PL_HEADER_MODE_CUSTOM") },
    { value: "datetime", label: say("PL_HEADER_MODE_DATETIME") },
    { value: "none", label: say("PL_HEADER_MODE_NONE") },
  ], next => o.model.setPlacement(row.id, { headerMode: next }));

  if (p.headerMode !== "none") {
    pick(say("PL_HEADER_LEVEL"), p.headerLevel, [{ value: "0", label: say("PL_HEADER_LEVEL_PLAIN") }]
      .concat(["1", "2", "3", "4", "5", "6"].map(n => ({ value: n, label: n }))),
      next => o.model.setPlacement(row.id, { headerLevel: next }));
  }

  if (p.headerMode === "custom") {
    type(say("PL_HEADER_TEXT"), p.customHeader, "",
      next => o.model.setPlacement(row.id, { customHeader: next }));
  }
  if (p.headerMode === "datetime") {
    type(say("PL_DATETIME"), p.datetimeFormat, "",
      next => o.model.setPlacement(row.id, { datetimeFormat: next }));
  }
}

/** Одна карточка правила. */
function ruleCard(host: El, row: RuleRow, index: number, o: RulesViewOpts, drag: {
  onMove: (from: number, to: number) => void;
  taken: { index: number | null };
}): void {
  const say = o.say || PLAIN;
  /*
   * Свёрнутая карточка занимает две строки: шапку с именем и управлением и
   * одну строку сводки. Нет набора развёрнутых — развёрнуты все: так вёрстка
   * ведёт себя без состояния.
   */
  const open = !o.expanded || o.expanded.has(row.id);
  const card = el(host, "div", "io-rule"
    + (row.enabled ? "" : " io-rule--off")
    + (open ? "" : " io-rule--folded")
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
   * Сворачивание (З-6). Кнопка стоит первой в шапке: она про саму карточку, а
   * не про правило, — и остаётся живой при выключенном модуле. Свернуть
   * список правил можно и тогда, когда менять их нельзя.
   */
  const fold = btn(tools, "io-icon", {
    text: open ? "\u25be" : "\u25b8",
    label: say(open ? "RULE_COLLAPSE" : "RULE_EXPAND", ruleTitle(row, index)),
  });
  fold.addEventListener("click", (() => {
    if (!o.expanded) return;
    if (open) o.expanded.delete(row.id);
    else o.expanded.add(row.id);
    o.redraw();
  }) as never);

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

  if (!open) {
    summaryLine(main, row, o);
    /* Спор с соседом виден и свёрнутым: он про правило, а не про его вид. */
    if (row.conflict) {
      const folded = el(main, "div", "io-rule__warn");
      el(folded, "span", undefined, "\u26a0");
      el(folded, "span", undefined, row.conflict);
    }
    return;
  }

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
      .concat(o.templates.map(t => ({ value: t, label: templateName(t, o) })))
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

  /*
   * `Advanced settings` (З-5): своя ветка `Note content` у правила. Стоит под
   * `Move to folder` — там, где её и просил заказчик.
   */
  const adv = el(main, "div", "io-rule__out io-rule__advanced");
  el(adv, "span", "io-rule__arrow", "\u2192");
  el(adv, "span", undefined, say("RULE_ADVANCED"));
  const advPick = selectInput(adv, "io-select", {
    options: [
      { value: "default", label: say("RULE_ADVANCED_DEFAULT") },
      { value: "custom", label: say("RULE_ADVANCED_CUSTOM") },
    ],
    value: row.placementMode,
    label: say("RULE_ADVANCED_ARIA", ruleTitle(row, index)),
  });
  advPick.disabled = !o.enabled;
  advPick.addEventListener("change", (() => {
    if (!o.enabled) return;
    o.model.setPlacementMode(row.id, advPick.value === "custom" ? "custom" : "default");
    o.redraw();
  }) as never);

  if (row.placementMode === "custom") placementRows(main, row, index, o);

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
    /* Новое правило рождается развёрнутым: его надо настроить (З-6). */
    const id = o.model.addRule();
    if (o.expanded && id) o.expanded.add(id);
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
      ? say("NO_FIELDS_YET")
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
      el(chips, "span", "io-kind__none", say("VALUES_EMPTY"));
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

/**
 * Подсказка под заголовком диалога: почему значений может не быть.
 *
 * Слово живёт в каталоге (`CONDITION_TIP`), а здесь только адрес. До
 * 2026-09-08 тут стоял сам текст — то есть второе его объявление, и строка
 * каталога никем не спрашивалась (долг A46, У-82).
 */
export const CONDITION_DIALOG_NOTE = "CONDITION_TIP";

export { KIND_LABEL, OP_AND, OP_OR, RULE_FALLBACK };
