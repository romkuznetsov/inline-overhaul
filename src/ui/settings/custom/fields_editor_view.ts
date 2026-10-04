/**
 * Редактор Fields (PRD 10.2, Ф1–Ф20): слева список по Block, справа выбранный
 * Field. Геометрия и тексты — с прототипа (Р8). Записей в конфиг здесь нет:
 * всё через `fields_model.ts`, их стережёт `tests/fixtures/order_board_write_map.txt`.
 * Выбранный Field — состояние вида, в `data.json` не пишется (О0).
 */

import type { El, ElButton, ElInput, DragEv } from "./dom.ts";
import { el, btn, cssVar, insertAtCaret, itemRow, onEnter, rich, selectInput, textInput, themePair, tipBelow, type ThemePair } from "./dom.ts";
import type { CommandCategory, CustomBlock, FieldSide, FieldsModel, FieldRow, NewFieldSetup, ValueAt, ValuesEditor, ValueTreeRow } from "./fields_model.ts";
import type { FieldKind, SettingsCtx, ValueVisibility } from "../types.ts";
import { CONTRAST_FLOOR, contrastRatio, contrastWarning, toHexColor } from "./contrast.ts";
import { applyTagVars, bubble, bubbleLabel, frame } from "./previews.ts";
import { sayIn } from "../texts_blocks.ts";
import { attachPicker, PICK_ALL } from "./char_picker.ts";
import { attachNoteSuggest } from "./new_field_dialog.ts";
import { drawCategoriesTable } from "./command_categories.ts";
import { attachRowDrag, type DragHold } from "./row_drag.ts";
import { attachPrefixPicker } from "./prefix_picker.ts";
import { canOpenHotkeys, hotkeyOf, openHotkeys } from "./hotkeys.ts";
import { TYPE_COLOR, bareToken, typeColor, typeInk } from "./preview_data.ts";
/*
 * Ключ вида значения-ссылки — тот же, что у слоя оформления (`wikilinkVisualToken`,
 * 2026-09-20 п.14): одно объявление на панель и заметку.
 */
import sharedUtils from "../../../core/shared_utils.js";
import {
  CARDINALITY_OPTIONS,
  NOT_WRITTEN,
  VALUE_RULE_OPTIONS,
  propertyPicker,
  vaultProperties,
  yamlExamples,
} from "./yaml_property.ts";

/* ---- тексты и цвета типов --------------------------------------------- */

/**
 * Подпись типа: в конфиге `wikilink`/`element` остаются (З1). `Emoji` вместо
 * `Element` — короче, не съедает имя Field в узкой колонке (2026-08-27).
 */
export const TYPE_NAME: Record<FieldKind, string> = {
  tag: "TYPE_TAG",
  wikilink: "TYPE_LINK",
  element: "TYPE_ELEMENT",
  command: "TYPE_COMMAND",
};

/** Знак типа в плитке списка Fields — то, что тип пишет в строку. */
const TYPE_GLYPH: Record<FieldKind, string> = {
  tag: "#",
  wikilink: "[[",
  /* \u0421\u043C\u0430\u0439\u043B\u0438\u043A \u0442\u0435\u043A\u0441\u0442\u043E\u043C (FE0E): \u0446\u0432\u0435\u0442\u043D\u043E\u0439 \u044D\u043C\u043E\u0434\u0437\u0438 \u043D\u0430 \u0437\u0430\u043B\u0438\u0432\u043A\u0435 \u043D\u0435 \u0447\u0438\u0442\u0430\u043B\u0441\u044F (\u0435\u0433\u043E \uD83D\uDCAC \u043A \u0442\u0435\u0441\u0442\u0443 1 \u0446\u0438\u043A\u043B\u0430 130). */
  element: "\u263A\uFE0E",
  command: "/",
};

/** Цвет чипа типа (Ф4); карта в `preview_data.ts`, общая с предпросмотрами (У-32). */
export { TYPE_COLOR };

/* Подпись стороны — имя строки каталога, не слово, иначе перевод не применяется (У-82). */
const SIDE_LABEL = { left: "SIDE_LEFT", right: "SIDE_RIGHT" } as const;


/** Пустая сторона — приглашение, а не ошибка (ПЗ2, ПЗ3). */

/* Короткое имя Field; в конфиге `order.labels` (З1). */

/** Режим размещения: в конфиге `freeRoam` = `off`/`minimal`/`full`, в панели `Behavior` (З1). */
const BEHAVIOR_OPTIONS = [
  { value: "off", name: "BEHAVIOR_STRICT" },
  { value: "minimal", name: "BEHAVIOR_INSERT_ONLY" },
  /* `Free` снят (PRD 10.13.260, `В-203`): вставка у каретки — это custom block. */
] as const;

/** Ф10: порядок Values и есть порядок цикла. Сказано один раз, в шапке таблицы. */
/** 1.4.1.2.5: заголовок `Behavior` был единственным разделом без «?». */

/** У Field типа element значение одно, и раздел называется в единственном. */

/** 1.4.1.2.1: шапка правой колонки. */


/** Ф9: как Value показывается в строке. Значения конфига прежние (З1). */
const SHOWN_OPTIONS = [
  { value: "default", name: "SHOWN_DEFAULT" },
  { value: "empty", name: "SHOWN_EMPTY" },
  { value: "custom", name: "SHOWN_CUSTOM" },
] as const;

/* У значения-ссылки два положения (2026-09-20 п.14): без `Empty` — спрятанной ссылке нечем вернуть переход. */
const LINK_SHOWN_OPTIONS = [
  { value: "default", name: "SHOWN_DEFAULT" },
  { value: "custom", name: "SHOWN_CUSTOM" },
] as const;



/**
 * Работает ли Field: `no` — выключен везде, `hotkey_only` — команды работают,
 * из TagWheel убран (З1). Без контрола ветка `pkm.behavior.order.active`
 * осталась бы недостижимой (2026-08-27).
 */
const ACTIVE_OPTIONS = [
  { value: "yes", name: "ACTIVE_YES" },
  { value: "no", name: "ACTIVE_NO" },
  { value: "hotkey_only", name: "ACTIVE_COMMANDS_ONLY" },
] as const;

/**
 * Положение дочернего Field; ряд у `tag` и `wikilink` (у `element` Values нет, З8).
 * `After parent` — умолчание, стоит первым (п.12, 2026-09-22); `Show always` —
 * и без родителя; `Hide` — нет нигде; `Show when press Alt` (`З-36`) — в tagWheel
 * только при зажатом `Alt`. Пишет `setSubMode`: две записи, порядок важен.
 */
const CHILD_OPTIONS = [
  { value: "after-parent", name: "CHILD_AFTER_PARENT" },
  { value: "always", name: "CHILD_ALWAYS" },
  { value: "alt", name: "CHILD_ALT" },
  { value: "hide", name: "CHILD_HIDE" },
] as const;

/** Родитель, когда дочернее Value поставлено без него (2026-09-19). Ряд только при `Show always`. */
/** Родительские Values — навигатор (PRD 10.13.269). */
const CHILD_NAV_OPTIONS = [
  { value: "off", name: "CHILD_NAV_OFF" },
  { value: "on", name: "CHILD_NAV_ON" },
] as const;

/** `#parent #child` или `#parent/child` — у каждого Field тегов (10.13.309). */
const CHILD_FORMAT_OPTIONS = [
  { value: "separate", name: "CHILD_FORMAT_SEPARATE" },
  { value: "nested", name: "CHILD_FORMAT_NESTED" },
] as const;

/** `Use as MOC` у Link (тест 3 цикла 98). */
const MOC_OPTIONS = [
  { value: "yes", name: "MOC_YES" },
  { value: "no", name: "MOC_NO" },
] as const;

const CHILD_PARENT_OPTIONS = [
  { value: "keep", name: "CHILD_PARENT_KEEP" },
  { value: "add", name: "CHILD_PARENT_ADD" },
] as const;

/**
 * Предусловие Field (10.13.4): есть ли, какой Field, какое значение; две
 * последние строки только при `Yes`. Пишется `dependsOn` и `enabledForParentValues`.
 */
const PREREQ_OPTIONS = [
  { value: "no", name: "PREREQ_NO" },
  { value: "yes", name: "PREREQ_YES" },
] as const;

/** Пока Field не выбран, писать нечего: пустое значение ничего не пишет. */


/** Свойства заметки — свой раздел (2026-08-27); «?» у заголовка, у строки только описание. */
/* Подсказка у строки возвращена 2026-09-01 (1.3.2.1) после обратного решения 2026-08-27. */
/* Подсказка в пустом поле (2026-08-27). */
/* Полный набор настроек свойства (10.9), перенесён из блока `Note properties` (2026-08-28). */

/* Шесть слов — исключение из Г10, записано в PRD 10.9. */

/* Видимая строка, поэтому без точки в конце (Р10). */

/* Текст задан заказчиком 2026-08-28. */

/**
 * Подсказки колонок Values — имена строк каталога, не слова (У-82, У-80).
 * Подсказка у каждой подписанной колонки (2026-09-08). «?» под текстом
 * заголовка — колонки узкие; тело раскрывается во всю ширину таблицы.
 */
function columnTips(isLink: boolean): Record<string, string> {
  return {
    /* Строка заказчика вместо подписи в подвале таблицы. */
    Level: "LEVEL_TIP",
    /* У ссылки своя запись значения, подсказка о ней (2026-08-27). */
    Value: isLink ? "VALUE_LINK_TIP" : "VALUE_TAG_TIP",
    Prefix: "VALUE_PREFIX_TIP",
    Show: "VALUE_SHOWN_TIP",
    Fill: "VALUE_FILL_TIP",
    Text: "VALUE_TEXT_TIP",
    Side: "VALUE_SIDE_TIP",
    Preview: "VALUE_PREVIEW_TIP",
  };
}

/** Подписи вариантов — имена каталога (10.13.47, A46, У-82); один помощник на все таблицы. */
function labelled(
  say: Say,
  options: readonly { readonly value: string; readonly name: string }[],
): Array<{ value: string; label: string }> {
  return options.map(o => ({ value: o.value, label: say(o.name) }));
}

/**
 * Как вёрстка спрашивает текст (10.13.47): `const say = words(o)`. Английское —
 * в `texts_blocks.ts` (У-32); имена строк — прежние имена констант.
 */
type Say = (name: string, ...args: readonly (string | number)[]) => string;

const words = (o: { ctx: SettingsCtx }): Say => sayIn("field-editor", o.ctx);

/* ---- то, с чем работает вёрстка --------------------------------------- */

/** Состояние вида. В конфиг не попадает (О0). */
export interface FieldsViewState {
  /** Ключ выбранного Field. Пустая строка — выбран первый по порядку. */
  selected: string;
  /**
   * Fields со строкой `Prerequisite Field` = `Yes` без выбранного Field —
   * состояние вида: в конфиг предусловие попадает только вместе с Field.
   */
  prereqOpen?: Record<string, boolean>;
}

/** Ответ окна `Add Field`. */
export interface NewField {
  /** Знак Field типа Element (BUGHUNT S4): без него tagWheel не открывается. */
  marker?: string;
  /** Системное имя: им Field назван в конфиге и в именах его команд. */
  name: string;
  kind: FieldKind;
  /** Главное сразу — Block, Values, вид Element (2026-09-27). */
  setup?: NewFieldSetup;
}

export interface FieldsViewOpts {
  model: FieldsModel;
  /** Настройки панели для колонки `Preview`: пузырь рисуется кодом живых предпросмотров (П9). */
  ctx: SettingsCtx;
  state: FieldsViewState;
  /** Модуль выключен: вёрстка показывается, но ничего не меняет. */
  enabled: boolean;
  showTips: boolean;
  /** Тумблер `Show option IDs in tips`: подпись id в конце подсказки (A3, C52). */
  showIds?: boolean;
  /** Перерисовать редактор целиком: список зависит от порядка Fields. */
  redraw: () => void;
  /** `Escape` сворачивает выбиралку знака, а не окно настроек (`В-196`). */
  holdKeys?: (onEscape: () => void) => () => void;
  /** Показать сообщение человеку. Текст приходит от модели, показывает панель. */
  notice: (text: string) => void;
  /**
   * Спросить имя и тип нового Field. `Modal` рисует панель: блок о платформе не
   * знает (заглушка Г16). `null` — отказ.
   */
  askNewField: (done: (answer: NewField | null) => void) => void;
  /** Подтверждение удаления Field: уносит Values, цвета и свойство заметки. */
  confirmDeleteField: (name: string, done: (yes: boolean) => void) => void;
  /** Окно переименования Field: старый тег в заметках останется, хоткей отвяжется (1.4.1.2.2). */
  askRename?: (name: string, done: (next: string | null) => void) => void;
  /**
   * Переименование Value-ссылки (2026-09-27, тест 7): есть заметка — окно
   * предлагает переименовать и её. `apply` пишет, `revert` возвращает поле; нет
   * шва — пишется сразу. `live` — с первой буквы (тест 2 цикла 98): окно только
   * при наличии ссылок, ответ — открылось ли.
   */
  askLinkValueRename?: (oldToken: string, nextToken: string, apply: (name: string) => void, revert: () => void, live?: boolean) => boolean;
  /** Окно имени custom block: то же окно, но без цены — хоткей держится за `id`. */
  askRenameBlock?: (name: string, done: (next: string | null) => void) => void;
  /**
   * Подтверждение удаления custom block вместе с его Field (`В-205`): окно
   * называет их число и имена. У пустого блока окна нет.
   */
  confirmDeleteBlock?: (name: string, fields: readonly string[], done: (yes: boolean) => void) => void;
}

/* ---- сворачивание разделов правой колонки (`З-34`) --------------------- */

/**
 * Свёрнутые разделы правой колонки (`З-34`). Состояние взгляда: не в
 * `data.json` и не в отмене. Ключ — род раздела, не Field.
 */
const FOLDED_SUBS = new Set<string>();

/** Класс на теле свёрнутого раздела; видимость решает `styles.css`. */
const SUB_SHUT_CLASS = "io-subshut";

/**
 * Знак сворачивания у подписи раздела. Прячется своё тело раздела: у `El`
 * нет перехода к следующему брату (У-45). Знак и класс — как у заголовка группы.
 */
function foldableSub(head: El, body: El, key: string, label: string, tipHost?: El): void {
  const mark = btn(head, "io-fold", { text: "", label: "" });
  const paint = (): void => {
    const shut = FOLDED_SUBS.has(key);
    mark.textContent = shut ? "▸" : "▾";
    if (shut) mark.classList.add("io-fold--shut");
    else mark.classList.remove("io-fold--shut");
    mark.setAttribute("aria-expanded", shut ? "false" : "true");
    mark.setAttribute("aria-label", (shut ? "Expand " : "Collapse ") + label);
    for (const node of tipHost ? [body, tipHost] : [body]) {
      if (shut) node.classList.add(SUB_SHUT_CLASS);
      else node.classList.remove(SUB_SHUT_CLASS);
    }
  };
  mark.addEventListener("click", (() => {
    if (FOLDED_SUBS.has(key)) FOLDED_SUBS.delete(key);
    else FOLDED_SUBS.add(key);
    paint();
  }) as never);
  paint();
}

/* ---- раздел `Commands` правой колонки (`З-33`) ------------------------- */

/** Одна команда так, как её отдаёт плагин: имя и идентификатор. */
/* `short` — имя без области (п.6, 2026-09-22), считает `buildOwnCommandList`. */
interface FieldCommand { id: string; name: string; short?: string; group?: string }

/**
 * Команды выбранного Field и хоткеи (`З-33`). Список — у плагина
 * (`listOwnCommands`, нынешний конфиг, У-85); свой Field — по `group` из
 * `buildOwnCommandList` (У-32). Нет платформы — нет раздела (З8).
 */
function fieldCommandsSection(detail: El, row: FieldRow, o: FieldsViewOpts): () => void {
  const say = words(o);
  const platform = o.ctx.platform;
  if (!platform) return () => {};
  const plugin = platform.plugin as {
    listOwnCommands?: () => readonly FieldCommand[];
  } & Record<string, unknown>;
  if (typeof plugin.listOwnCommands !== "function") return () => {};

  const closers: Array<() => void> = [];
  const head = el(detail, "div", "io-sub io-item__namerow");
  el(head, "span", undefined, say("COMMANDS_HEAD"));
  const headTip = el(detail, "div", "io-tiphost");
  closers.push(tipBelow({
    head,
    host: headTip,
    text: say("COMMANDS_HEAD_TIP"),
    label: say("COMMANDS_HEAD"),
    id: "io-field-commands-tip",
    showTips: o.showTips, showIds: o.showIds,
  }));
  const sec = el(detail, "div", "io-fields__sec");
  foldableSub(head, sec, "commands", say("COMMANDS_HEAD"), headTip);

  const card = el(sec, "div", "io-cmd io-cmd--field");
  const headRow = el(card, "div", "io-cmd__head");
  el(headRow, "div", undefined, say("COMMANDS_COL_NAME"));
  el(headRow, "div", undefined, say("COMMANDS_COL_HOTKEY"));

  const mine = plugin.listOwnCommands().filter(
    c => String(c && c.group ? c.group : "") === row.strictName,
  );
  if (!mine.length) {
    el(card, "div", "io-fields__hint", say("COMMANDS_EMPTY"));
    return () => { closers.forEach(fn => fn()); };
  }

  const canOpen = canOpenHotkeys(plugin);
  for (const cmd of mine) {
    const line = el(card, "div", "io-cmd__row");
    /* Имя без области (п.6, 2026-09-22); в запрос к `Hotkeys` уходит полное. */
    el(line, "div", "io-cmd__name", cmd.short || cmd.name);
    const cell = el(line, "div");
    const current = hotkeyOf(plugin, cmd.id);
    const key = btn(cell, "io-hk" + (current ? "" : " io-hk--none"), {
      text: current || say("HOTKEY_NOT_SET"),
      label: say(current ? "HOTKEY_CHANGE" : "HOTKEY_ASSIGN", cmd.name),
      title: say("HOTKEY_OPEN"),
    });
    /* Приватного API нет — кнопке некуда вести, и она неактивна (К-2). */
    key.disabled = !canOpen;
    key.addEventListener("click", (() => {
      if (canOpen) openHotkeys(plugin, cmd.name);
    }) as never);
  }

  return () => { closers.forEach(fn => fn()); };
}

/* ---- левая колонка: список Fields -------------------------------------- */

/** Список Fields двумя сторонами (Ф1): сторона и есть Block. */
export function renderFieldList(list: El, o: FieldsViewOpts): void {
  const say = words(o);
  const rows = o.model.listFields();
  /* Тянутое — ключом: строку перерисует правка. Дочерний отдаёт ключ родителя (Ф3). */
  let dragged = "";

  const ownerOf = (row: FieldRow): string => row.parent || row.key;

  const side = (value: FieldSide, block?: CustomBlock): void => {
    const sec = el(list, "div", "io-side");
    const cap = el(sec, "div", "io-side__cap");
    const label = el(cap, "span", "io-side__label",
      block ? block.name : say(SIDE_LABEL[value === "right" ? "right" : "left"]));
    /*
     * Без «?» у подписи стороны — объявленное исключение (2026-09-08): колонка
     * 188 точек (У-105). Смысл в `LIST_TIP`; здесь `aria-label` (У-21).
     */
    label.setAttribute("aria-label", block
      ? say("SIDE_CUSTOM_ABOUT", block.name)
      : say(value === "left" ? "SIDE_LEFT_ABOUT" : "SIDE_RIGHT_ABOUT"));
    /* У раздела custom block — карандаш и корзина, как у Field (PRD 10.13.260). */
    if (block) blockTools(cap, block, rows, o);

    /* Бросок мимо строк — в конец стороны. */
    sec.addEventListener("dragover", ((ev: DragEv) => {
      ev.preventDefault();
      sec.classList.add("io-side--over");
    }) as never);
    sec.addEventListener("dragleave", (() => sec.classList.remove("io-side--over")) as never);
    sec.addEventListener("drop", ((ev: DragEv) => {
      ev.preventDefault();
      sec.classList.remove("io-side--over");
      if (!dragged || !o.enabled) return;
      o.model.moveKey(value, dragged);
      o.redraw();
    }) as never);

    const mine = rows.filter(r => r.side === value);

    /*
     * Подпись стороны — место «перед первой строкой» (2026-09-12): иначе бросок
     * выше первой строки доставался стороне и значил «в конец». Подсветка — черта под подписью.
     */
    cap.addEventListener("dragover", ((ev: DragEv) => {
      ev.preventDefault();
      ev.stopPropagation();
      cap.classList.add("io-side__cap--over");
    }) as never);
    cap.addEventListener("dragleave", (() => cap.classList.remove("io-side__cap--over")) as never);
    cap.addEventListener("drop", ((ev: DragEv) => {
      ev.preventDefault();
      ev.stopPropagation();
      cap.classList.remove("io-side__cap--over");
      if (!dragged || !o.enabled) return;
      const head = mine[0];
      const first = head ? ownerOf(head) : "";
      /* Первую строку бросок на подпись не двигает: она уже первая. */
      if (first === dragged) return;
      /* Пустая сторона: вставать не перед чем, и бросок значит «сюда». */
      if (first) o.model.moveKey(value, dragged, first);
      else o.model.moveKey(value, dragged);
      o.redraw();
    }) as never);

    if (!mine.length) {
      el(sec, "div", "io-side__empty", say("EMPTY_SIDE"));
      return;
    }

    for (const row of mine) {
      const item = el(sec, "div", "io-fields__item" + (row.parent ? " io-fields__item--child" : ""));
      const current = row.key === selectedKey(rows, o.state);
      /* Строка — контейнер, не кнопка (Ф19): кнопка в кнопке слипается для клавиатуры и экранного чтения. */
      item.setAttribute("aria-current", current ? "true" : "false");

      const grip = el(item, "span", "io-grip", "⠿");
      grip.setAttribute("role", "button");
      /* Только `aria-label`: `title` рядом даёт вторую всплывающую коробку. */
      const gripLabel = row.parent
        ? say("DRAG_CHILD_FIELD", row.label, parentLabel(rows, row.parent))
        : say("DRAG_FIELD", row.label);
      grip.setAttribute("aria-label", gripLabel);
      grip.draggable = o.enabled;
      grip.addEventListener("dragstart", ((ev: DragEv) => {
        dragged = ownerOf(row);
        item.classList.add("io-dragging");
        try { ev.dataTransfer?.setData("text/plain", dragged); } catch { /* Obsidian на десктопе даёт dataTransfer всегда */ }
      }) as never);
      grip.addEventListener("dragend", (() => {
        item.classList.remove("io-dragging");
        dragged = "";
      }) as never);

      item.addEventListener("dragover", ((ev: DragEv) => {
        ev.preventDefault();
        ev.stopPropagation();
        item.classList.add("io-dragover");
      }) as never);
      item.addEventListener("dragleave", (() => item.classList.remove("io-dragover")) as never);
      item.addEventListener("drop", ((ev: DragEv) => {
        ev.preventDefault();
        ev.stopPropagation();
        item.classList.remove("io-dragover");
        if (!dragged || !o.enabled) return;
        /* Бросок на дочернюю строку — это бросок перед её родителем (Ф3). */
        const before = ownerOf(row);
        if (before === dragged) return;
        /*
         * Field встаёт на место строки, как в Smart Rules и Binder (H3.5): сверху
         * вниз — за ней, снизу вверх — перед ней. Счёт как у `stepField`.
         */
        const peers = mine.filter(r => !r.parent).map(r => r.key);
        const from = peers.indexOf(dragged);
        const to = peers.indexOf(before);
        if (from !== -1 && from < to) {
          if (peers[to + 1]) o.model.moveKey(row.side, dragged, peers[to + 1]);
          else o.model.moveKey(row.side, dragged);
        } else {
          o.model.moveKey(row.side, dragged, before);
        }
        o.redraw();
      }) as never);

      const pick = btn(item, "io-fields__pick", { label: say("SHOW_FIELD", row.label) });
      /* Тип — точкой цвета типа: чип съедал имя (его 💬 к тесту 1, цикл 127); слово — в подсказке и чипом справа. */
      /* Плитка со знаком типа, в стиле бейджей бренд-бука (его 💬 к тесту 1 цикла 128). */
      const dot = el(pick, "span", "io-typedot io-typedot--" + row.kind, TYPE_GLYPH[row.kind]);
      dot.setAttribute("aria-label", say(TYPE_NAME[row.kind]));
      cssVar(dot, "--io-chip-bg", typeColor(row.kind));
      cssVar(dot, "--io-chip-ink", typeInk(row.kind));
      el(pick, "span", "io-fields__name", row.label);
      pick.addEventListener("click", (() => {
        o.state.selected = row.key;
        o.redraw();
      }) as never);

      /* Место под стрелки занято всегда, видны у рабочей строки (Ф18); дочерний ходит за родителем (Ф20). */
      const tools = el(item, "span", "io-fields__tools");
      if (row.parent) continue;
      const arrow = (glyph: string, dir: -1 | 1, label: string): void => {
        const b = btn(tools, "io-icon", { text: glyph, label });
        b.disabled = !o.enabled;
        b.addEventListener("click", (() => {
          if (!o.enabled) return;
          stepField(o.model, rows, row, dir);
          o.redraw();
        }) as never);
      };
      arrow("↑", -1, say("MOVE_FIELD_UP", row.label));
      arrow("↓", 1, say("MOVE_FIELD_DOWN", row.label));
    }
  };

  side("left");
  el(list, "div", "io-side__rule");
  side("right");
  for (const block of o.model.listBlocks()) {
    el(list, "div", "io-side__rule");
    side(`custom:${block.id}`, block);
  }

  const addWrap = el(list, "div", "io-fields__add");
  /* `Add Block` первой, `Add Field` за ней — его пункт 2026-09-24. */
  /* Не акцентная: цвет должен отличаться от `Add Field`. */
  const addBlock = btn(addWrap, "io-btn io-btn--sm",
    { text: say("ADD_BLOCK"), label: say("ADD_BLOCK_LABEL") });
  addBlock.disabled = !o.enabled;
  addBlock.addEventListener("click", (() => {
    if (!o.enabled) return;
    o.model.addBlock();
    o.redraw();
  }) as never);
  /* Акцентная (2026-08-27, отменяет «нейтральная» из Ф5). */
  const add = btn(addWrap, "io-btn io-btn--sm io-btn--cta",
    { text: say("ADD_FIELD"), label: say("ADD_FIELD_LABEL") });
  add.disabled = !o.enabled;
  addFieldAction(add, o);
}

/** Карандаш и корзина у подписи custom block; нет окна — нет кнопок (З8). */
function blockTools(cap: El, block: CustomBlock, rows: readonly FieldRow[], o: FieldsViewOpts): void {
  const say = words(o);
  cap.classList.add("io-side__cap--block");
  const tools = el(cap, "span", "io-side__tools");
  if (o.askRenameBlock) {
    const ask = o.askRenameBlock;
    const pen = btn(tools, "io-icon", { text: "\u270E", label: say("RENAME_BLOCK", block.name) });
    pen.disabled = !o.enabled;
    pen.addEventListener("click", (() => {
      if (!o.enabled) return;
      ask(block.name, next => {
        if (!next) return;
        const res = o.model.renameBlock(block.id, next);
        if (!res.ok && res.error) o.notice(res.error);
        o.redraw();
      });
    }) as never);
  }
  const inside = rows.filter(r => !r.parent && r.side === `custom:${block.id}`).map(r => r.strictName);
  const drop = (): void => {
    o.model.deleteBlock(block.id);
    o.state.selected = "";
    o.redraw();
  };
  if (inside.length && !o.confirmDeleteBlock) return;
  /* Корзина красная и маской: цветной эмодзи `color` не перекрашивает (2026-09-24). */
  const bin = btn(tools, "io-icon io-icon--danger", { label: say("DELETE_BLOCK", block.name) });
  el(bin, "span", "io-danger__icon");
  bin.disabled = !o.enabled;
  bin.addEventListener("click", (() => {
    if (!o.enabled) return;
    if (!inside.length) { drop(); return; }
    (o.confirmDeleteBlock as NonNullable<FieldsViewOpts["confirmDeleteBlock"]>)(block.name, inside, yes => {
      if (yes) drop();
    });
  }) as never);
}

/** Шаг Field стрелкой; на краю стороны — через линию, иначе сторону с клавиатуры не сменить (Ф17). */
function stepField(model: FieldsModel, rows: readonly FieldRow[], row: FieldRow, dir: -1 | 1): void {
  const side: FieldSide = row.side;
  const peers = rows.filter(r => !r.parent && r.side === side).map(r => r.key);
  const i = peers.indexOf(row.key);
  const target = peers[i + dir];
  if (target) {
    if (dir < 0) model.moveKey(side, row.key, target);
    else if (peers[i + 2]) model.moveKey(side, row.key, peers[i + 2]);
    else model.moveKey(side, row.key);
    return;
  }
  /* Разделы кольцом: `Left Block`, `Right Block`, custom block (PRD 10.13.260, п.3); стрелка переходит в соседний. */
  const order: FieldSide[] = ["left", "right", ...model.listBlocks().map(b => `custom:${b.id}` as FieldSide)];
  const at = order.indexOf(side);
  const other = order[(at + (dir > 0 ? 1 : order.length - 1)) % order.length] as FieldSide;
  const there = rows.filter(r => !r.parent && r.side === other).map(r => r.key);
  if (dir > 0 && there[0]) model.moveKey(other, row.key, there[0]);
  else model.moveKey(other, row.key);
}

/** Ключ выбранного Field; не выбран — первый по порядку, правая колонка не пустует. */
export function selectedKey(rows: readonly FieldRow[], state: FieldsViewState): string {
  const top = rows.filter(r => !r.parent);
  if (state.selected && rows.some(r => r.key === state.selected)) return state.selected;
  return top.length ? (top[0] as FieldRow).key : "";
}

function parentLabel(rows: readonly FieldRow[], key: string): string {
  const found = rows.find(r => r.key === key);
  return found ? found.label : key;
}

/** Добавление Field: имя и тип окном (2026-08-27) — тип потом не меняется. */
function addFieldAction(button: ElButton, o: FieldsViewOpts): void {
  const say = words(o);
  button.addEventListener("click", (() => {
    if (!o.enabled) return;
    o.askNewField(answer => {
      if (!answer) return;
      const res = o.model.addField(answer.name, answer.kind, answer.marker);
      if (!res.ok) {
        o.notice(res.error || say("NEW_FIELD_FAILED"));
        return;
      }
      /* Главное из окна — моделью правой колонки; отказ Value называется, Field остаётся. */
      if (res.key && answer.setup) {
        const set = o.model.configureNewField(res.key, answer.setup);
        if (!set.ok && set.error) o.notice(set.error);
      }
      /* Новый Field выбирается сразу: за добавлением идёт настройка. */
      if (res.key) o.state.selected = res.key;
      o.redraw();
    });
  }) as never);
}

/* ---- правая колонка: выбранный Field ----------------------------------- */

/**
 * Предусловие Field (10.13.4): есть ли; при `Yes` — какой Field и
 * необязательное значение. Ждать некого (кандидаты считает модель) — строки нет (З8).
 */
function prerequisiteRows(detail: El, row: FieldRow, o: FieldsViewOpts): Array<() => void> {
  const say = words(o);
  const closers: Array<() => void> = [];
  const state = o.model.getPrerequisite(row.key);
  if (!state.candidates.length && !state.fieldId) return closers;

  if (!o.state.prereqOpen) o.state.prereqOpen = {};
  const opened = Boolean(state.fieldId || o.state.prereqOpen[row.key]);

  const on = itemRow(detail, {
    name: say("PREREQ_NAME"),
    desc: say("PREREQ_DESC"),
    tip: say("PREREQ_TIP"),
    tipId: "io-field-prereq-tip",
    showTips: o.showTips, showIds: o.showIds,
  });
  closers.push(on.closeTip);
  const onPick = selectInput(on.control, "io-select", {
    options: labelled(say, PREREQ_OPTIONS),
    value: opened ? "yes" : "no",
    label: say("PREREQ_NAME") + " for " + row.strictName,
  });
  onPick.disabled = !o.enabled;
  onPick.addEventListener("change", (() => {
    if (!o.enabled) return;
    const yes = onPick.value === "yes";
    (o.state.prereqOpen as Record<string, boolean>)[row.key] = yes;
    /* `No` снимает предусловие; `Yes` ничего не пишет, пока Field не выбран. */
    if (!yes && state.fieldId) o.model.setPrerequisite(row.key, "", "");
    o.redraw();
  }) as never);

  if (!opened) return closers;

  const which = itemRow(detail, {
    name: say("PREREQ_PICK_NAME"),
    desc: say("PREREQ_PICK_DESC"),
    tip: say("PREREQ_PICK_TIP"),
    tipId: "io-field-prereq-which-tip",
    showTips: o.showTips, showIds: o.showIds,
  });
  closers.push(which.closeTip);
  const whichPick = selectInput(which.control, "io-select", {
    options: [{ value: "", label: say("PREREQ_NOT_CHOSEN") }].concat(
      state.candidates.map(c => ({ value: c.key, label: c.label })),
    ),
    value: state.fieldId,
    label: say("PREREQ_PICK_NAME") + " for " + row.strictName,
  });
  whichPick.disabled = !o.enabled;
  whichPick.addEventListener("change", (() => {
    if (!o.enabled) return;
    /* Смена Field уносит значение: значения принадлежат прежнему Field. */
    const res = o.model.setPrerequisite(row.key, whichPick.value, "");
    if (!res.ok && res.error) o.notice(res.error);
    o.redraw();
  }) as never);

  /* Значение спрашивать не у кого, пока не выбран Field. */
  if (!state.fieldId) return closers;

  const value = itemRow(detail, {
    name: say("PREREQ_VALUE_NAME"),
    desc: say("PREREQ_VALUE_DESC"),
    tip: say("PREREQ_VALUE_TIP"),
    tipId: "io-field-prereq-value-tip",
    showTips: o.showTips, showIds: o.showIds,
  });
  closers.push(value.closeTip);
  const valuePick = selectInput(value.control, "io-select", {
    options: [{ value: "", label: say("PREREQ_ANY_VALUE") }].concat(
      state.values.map(v => ({ value: v.value, label: v.label })),
    ),
    value: state.value,
    label: say("PREREQ_VALUE_NAME") + " for " + row.strictName,
  });
  valuePick.disabled = !o.enabled;
  valuePick.addEventListener("change", (() => {
    if (!o.enabled) return;
    const res = o.model.setPrerequisite(row.key, state.fieldId, valuePick.value);
    if (!res.ok && res.error) o.notice(res.error);
    o.redraw();
  }) as never);

  return closers;
}

/** Выбранный Field: имя, тип, запись в строку, удаление (Ф6). */
export function renderFieldDetail(detail: El, row: FieldRow, o: FieldsViewOpts): () => void {
  const say = words(o);
  const closers: Array<() => void> = [];

  /*
   * Шапка: системное имя (заголовок, не поле — стоит в командах и служебном
   * файле; 2026-08-27), тип и удаление. Короткое имя — своей строкой ниже.
   */
  const title = el(detail, "div", "io-fields__title");
  el(title, "h4", undefined, row.strictName);
  const typeChip = el(title, "span", "io-chip io-chip--typed", say(TYPE_NAME[row.kind]));
  cssVar(typeChip, "--io-chip-bg", typeColor(row.kind));
  cssVar(typeChip, "--io-chip-fg", typeInk(row.kind));
  /* Карандаш слева от корзины (1.4.1.2.2, 2026-08-31): переименовать можно, цену называет окно. Нет окна — нет кнопки (З8). */
  if (o.askRename) {
    const ask = o.askRename;
    const pencil = btn(title, "io-icon", {
      text: "\u270E",
      label: say("RENAME_FIELD", row.strictName),
    });
    pencil.disabled = !o.enabled;
    pencil.addEventListener("click", (() => {
      if (!o.enabled) return;
      ask(row.strictName, next => {
        if (!next) return;
        void Promise.resolve(o.model.setStrictName(row.key, next)).then(res => {
          if (!res.ok && res.error) o.notice(res.error);
          o.redraw();
        });
      });
    }) as never);
  }

  /* Удаление — белая корзина на красном (2026-08-27); значок обесцвечен фильтром, смысл — `aria-label` и `title`. */
  const del = btn(title, "io-danger", {
    label: say("DELETE_FIELD", row.strictName),
  });
  /* Текста у значка нет: корзину рисует маска в styles.css (1.4.1.2.3). */
  el(del, "span", "io-danger__icon");
  del.disabled = !o.enabled;
  del.addEventListener("click", (() => {
    if (!o.enabled) return;
    o.confirmDeleteField(row.strictName, yes => {
      if (!yes) return;
      o.model.deleteField(row.key);
      /* Выбранного Field больше нет: выбор возвращается к первому по порядку. */
      o.state.selected = "";
      o.redraw();
    });
  }) as never);

  /* Имя в TagWheel — строкой под шапкой, до `Behavior`. */
  const shortRow = itemRow(detail, {
    name: say("SHORT_NAME_NAME"),
    desc: say("SHORT_NAME_DESC"),
    tip: say("SHORT_NAME_TIP"),
    tipId: "io-field-short-tip",
    showTips: o.showTips, showIds: o.showIds,
  });
  closers.push(shortRow.closeTip);
  const short = textInput(shortRow.control, "io-text io-text--prop", {
    /* Пусто — значит короткого имени нет и в TagWheel стоит полное. */
    value: row.label === row.strictName ? "" : row.label,
    placeholder: row.strictName,
    label: say("SHORT_NAME_NAME") + " for " + row.strictName,
  });
  short.disabled = !o.enabled;
  short.addEventListener("change", (() => {
    if (!o.enabled) return;
    /* Пустое короткое имя не пишется, как в старой доске (Ф12). */
    if (!String(short.value || "").trim()) return;
    o.model.setLabel(row.key, short.value);
    o.redraw();
  }) as never);

  /*
   * Имя дочернего Field в tagWheel (2026-09-29): спрятано без дочерних Values
   * (З8), но не снято — снятое сдвигало бы дерево под фокусом (`keepview`).
   */
  /* У Command Field дочерняя ячейка — пресеты: видна, когда у категории их больше одного, умолчание `preset`. */
  const cmd = row.kind === "command";
  const subKey = row.subKey || (cmd ? row.key + "_sub" : "");
  if (subKey) {
    const subRow = itemRow(detail, {
      name: say("SHORT_SUB_NAME"),
      desc: say("SHORT_SUB_DESC"),
      tip: say("SHORT_SUB_TIP"),
      tipId: "io-field-short-sub-tip",
      showTips: o.showTips, showIds: o.showIds,
    });
    closers.push(subRow.closeTip);
    subRow.row.hidden = cmd
      ? !o.model.getCommandCategories(row.key).some(c => (c.presets || []).length > 1)
      : !o.model.valuesEditor(row.key).tree.some(n => (n.children || []).length > 0);
    const sub = textInput(subRow.control, "io-text io-text--prop", {
      value: o.model.getSubLabel(subKey),
      placeholder: cmd ? "preset" : o.model.subLabelShown(),
      label: say("SHORT_SUB_NAME") + " for " + row.strictName,
    });
    sub.disabled = !o.enabled;
    sub.addEventListener("change", (() => {
      if (!o.enabled) return;
      o.model.setSubLabel(subKey, sub.value);
      o.redraw();
    }) as never);
  }

  /* `Values` — под `Name in TagWheel`, над `Behavior`, для всех типов (1.4.1.2.4); у `element` — его блок. */
  /* У `element` значений нет: у него маркер, формат и способ шага (Ф6). */
  if (row.kind === "element") closers.push(renderElementRows(detail, row, o));
  else if (row.kind === "command") closers.push(renderCommandCategories(detail, row, o));
  else closers.push(renderValuesTable(detail, row, o));

  /* Раздел `Behavior`: Active, Prefix behavior, Child Field (2026-08-27); «?» — 1.4.1.2.5. */
  const behaviorHead = el(detail, "div", "io-sub io-item__namerow");
  el(behaviorHead, "span", undefined, say("BEHAVIOR_HEAD"));
  const behaviorHeadTip = el(detail, "div", "io-tiphost");
  closers.push(tipBelow({
    head: behaviorHead,
    host: behaviorHeadTip,
    text: say("BEHAVIOR_HEAD_TIP"),
    label: say("BEHAVIOR_HEAD"),
    id: "io-field-behavior-tip",
    showTips: o.showTips, showIds: o.showIds,
  }));
  /* Тело раздела: его и прячет знак сворачивания (`З-34`). */
  const behaviorSec = el(detail, "div", "io-fields__sec");
  foldableSub(behaviorHead, behaviorSec, "behavior", say("BEHAVIOR_HEAD"), behaviorHeadTip);

  /* У дочернего Field ряда нет: включает родитель через `setSubMode`, вторая точка — вторая правда. */
  if (!row.parent) {
    const active = itemRow(behaviorSec, {
      name: say("ACTIVE_NAME"),
      desc: say("ACTIVE_DESC"),
      tip: say("ACTIVE_TIP"),
      tipId: "io-field-active-tip",
      showTips: o.showTips, showIds: o.showIds,
    });
    closers.push(active.closeTip);
    const mode = selectInput(active.control, "io-select", {
      options: labelled(say, ACTIVE_OPTIONS),
      value: row.active,
      label: say("ACTIVE_FOR", row.strictName),
    });
    mode.disabled = !o.enabled;
    mode.addEventListener("change", (() => {
      if (!o.enabled) return;
      o.model.setActive(row.key, mode.value);
      o.redraw();
    }) as never);
  }

  /* В custom block строки нет: Field всегда у каретки (З8, PRD 10.13.260, п.6). Command Field Prefix не трогает (4.2). */
  if (!String(row.side).startsWith("custom:") && row.kind !== "command") {
  const behavior = itemRow(behaviorSec, {
    name: say("BEHAVIOR_NAME"),
    desc: say("BEHAVIOR_DESC"),
    tip: say("BEHAVIOR_TIP"),
    tipId: "io-field-behavior-tip",
    showTips: o.showTips, showIds: o.showIds,
  });
  closers.push(behavior.closeTip);
  const mode = selectInput(behavior.control, "io-select", {
    options: labelled(say, BEHAVIOR_OPTIONS),
    value: row.freeRoam,
    label: say("BEHAVIOR_FOR", row.strictName),
  });
  mode.disabled = !o.enabled;
  mode.addEventListener("change", (() => {
    if (!o.enabled) return;
    o.model.setFreeRoam(row.key, mode.value);
    o.redraw();
  }) as never);
  }

  /*
   * Положение дочернего Field (возвращён 2026-08-27). Потерю ловит сверка
   * причин записи в `fields_editor_write_map_tests.ts`, не карта веток.
   */
  if (row.subKey) {
    /* Состояние — у модели: `normalizePkmOrder` выбрасывает `_sub` из `left`/`right` (2026-08-27). */
    const subMode = o.model.getSubMode(row.subKey);
    const child = itemRow(behaviorSec, {
      name: say("CHILD_NAME"),
      desc: say("CHILD_DESC"),
      tip: say("CHILD_TIP"),
      tipId: "io-field-child-tip",
      showTips: o.showTips, showIds: o.showIds,
    });
    closers.push(child.closeTip);
    const pick = selectInput(child.control, "io-select", {
      options: labelled(say, CHILD_OPTIONS),
      value: subMode,
      label: say("CHILD_OF", row.strictName),
    });
    pick.disabled = !o.enabled;
    pick.addEventListener("change", (() => {
      if (!o.enabled) return;
      if (pick.value === subMode) return;
      o.model.setSubMode(row.subKey, pick.value);
      o.redraw();
    }) as never);

    /* Родитель — навигатор (PRD 10.13.269): под `Child Field`, недоступен при `Hide`. */
    const nav = o.model.getSubNavigator(row.subKey);
    const navRow = itemRow(behaviorSec, {
      name: say("CHILD_NAV_NAME"),
      desc: say("CHILD_NAV_DESC"),
      tip: say("CHILD_NAV_TIP"),
      tipId: "io-field-child-nav-tip",
      showTips: o.showTips, showIds: o.showIds,
    });
    closers.push(navRow.closeTip);
    const navPick = selectInput(navRow.control, "io-select", {
      options: labelled(say, CHILD_NAV_OPTIONS),
      value: nav ? "on" : "off",
      label: say("CHILD_NAV_OF", row.strictName),
    });
    navPick.disabled = !o.enabled || subMode === "hide";
    navPick.addEventListener("change", (() => {
      if (!o.enabled || subMode === "hide") return;
      if ((navPick.value === "on") === nav) return;
      o.model.setSubNavigator(row.subKey, navPick.value === "on");
      o.redraw();
    }) as never);

    /* Родитель у значения без него — только при `Show always`; при навигаторе не пишется вовсе. */
    if (subMode === "always" && !nav) {
      const parentRow = itemRow(behaviorSec, {
        name: say("CHILD_PARENT_NAME"),
        desc: say("CHILD_PARENT_DESC"),
        tip: say("CHILD_PARENT_TIP"),
        tipId: "io-field-child-parent-tip",
        showTips: o.showTips, showIds: o.showIds,
      });
      closers.push(parentRow.closeTip);
      const adds = o.model.getSubAddsParent(row.subKey);
      const parentPick = selectInput(parentRow.control, "io-select", {
        options: labelled(say, CHILD_PARENT_OPTIONS),
        value: adds ? "add" : "keep",
        label: say("CHILD_PARENT_OF", row.strictName),
      });
      parentPick.disabled = !o.enabled;
      parentPick.addEventListener("change", (() => {
        if (!o.enabled) return;
        if ((parentPick.value === "add") === adds) return;
        o.model.setSubAddsParent(row.subKey, parentPick.value === "add");
        o.redraw();
      }) as never);
    }

    /* Формат дочернего тега — над предусловием (его пункт цикла 135); `#a/b` пишут только теги. */
    if (row.kind === "tag") {
      const nested = o.model.getSubNested(row.subKey);
      const fmtRow = itemRow(behaviorSec, {
        name: say("CHILD_FORMAT_NAME"),
        desc: say("CHILD_FORMAT_DESC"),
        tip: say("CHILD_FORMAT_TIP"),
        tipId: "io-field-child-format-tip",
        showTips: o.showTips, showIds: o.showIds,
      });
      closers.push(fmtRow.closeTip);
      const fmtPick = selectInput(fmtRow.control, "io-select", {
        options: labelled(say, CHILD_FORMAT_OPTIONS),
        value: nested ? "nested" : "separate",
        label: say("CHILD_FORMAT_OF", row.strictName),
      });
      fmtPick.disabled = !o.enabled;
      fmtPick.addEventListener("change", (() => {
        if (!o.enabled) return;
        if ((fmtPick.value === "nested") === nested) return;
        o.model.setSubNested(row.subKey, fmtPick.value === "nested");
        o.redraw();
      }) as never);
    }
  }

  /* Предусловие — последним в `Behavior` (10.13.4); у дочернего его нет: `dependsOn` занят родителем (З8). */
  if (!row.parent && row.kind !== "command") closers.push(...prerequisiteRows(behaviorSec, row, o));

  /* Свойство заметки — у Field (2026-08-27); тип и правило — в `Note properties` (10.9). Command Field в свойство не пишет (постановка, раздел 3). */
  if (row.kind !== "command") {
  const propertyHead = el(detail, "div", "io-sub io-item__namerow");
  el(propertyHead, "span", undefined, say("YAML_HEAD"));
  const propertyHeadTip = el(detail, "div", "io-tiphost");
  closers.push(tipBelow({
    head: propertyHead,
    host: propertyHeadTip,
    text: say("YAML_HEAD_TIP"),
    label: say("YAML_HEAD"),
    id: "io-field-property-tip",
    showTips: o.showTips, showIds: o.showIds,
  }));
  /* Тело раздела: его и прячет знак сворачивания (`З-34`). */
  const propertySec = el(detail, "div", "io-fields__sec");
  foldableSub(propertyHead, propertySec, "yaml", say("YAML_HEAD"), propertyHeadTip);
  closers.push(yamlPropertyRows(propertySec, row, o));
  }

  /* Команды Field (`З-33`) — последним разделом, как в прототипе (Р8). */
  closers.push(fieldCommandsSection(detail, row, o));

  return () => { closers.forEach(fn => fn()); };
}

/**
 * Раздел `YAML property` (10.9 Я1–Я4). Пример считает движок через
 * `yamlExamples` (П9); нет платформы — строки примера нет.
 */
function yamlPropertyRows(detail: El, row: FieldRow, o: FieldsViewOpts): () => void {
  const say = words(o);
  const closers: Array<() => void> = [];
  /*
   * Перерисовка в `finally`: `plugin.setConfigPatch` после записи пересобирает
   * правила и TagWheel, и исключение оттуда оставляло экран старым (2026-08-28).
   * Сбой — в консоль (З8).
   */
  const commit = (write: () => void): void => {
    try {
      write();
    } catch (e) {
      console.error("inline-overhaul: запись свойства заметки не удалась", e);
    } finally {
      o.redraw();
    }
  };
  const cfg = o.ctx.platform ? o.ctx.platform.getConfig() : null;
  const rows = o.model.listYamlFields();
  const mine = rows.find(r => r.key === row.key);

  const property = itemRow(detail, {
    name: say("YAML_NAME"),
    desc: say("YAML_DESC"),
    tip: say("YAML_TIP"),
    tipId: "io-field-yaml-property-tip",
    showTips: o.showTips, showIds: o.showIds,
  });
  closers.push(property.closeTip);
  /* Имена свойств из vault (Я4); приватное API молчит — обычное поле. */
  const app = o.ctx.platform ? (o.ctx.platform.plugin as { app?: unknown }).app : null;
  const props = vaultProperties(app);
  /* Ссылка в свойстве `tags` — предупреждение, не запрет (2026-09-02, B21): Obsidian ссылок там не принимает. */
  const declaredType = (name: string): string => {
    const at = props.find(p => p.name === String(name || "").trim());
    return at ? String(at.type || "").trim().toLowerCase() : "";
  };
  if (row.kind === "wikilink" && declaredType(row.property) === "tags") {
    el(property.info, "div", "io-item__warn", say("YAML_TAGS_WARNING"));
  }
  propertyPicker(property.control, {
    value: row.property,
    label: row.strictName,
    placeholder: say("YAML_HINT"),
    say,
    props,
    /* Подсказку рисует платформа; без класса поле остаётся обычным полем. */
    suggest: o.ctx.platform && o.ctx.platform.AbstractInputSuggest
      ? { ctor: o.ctx.platform.AbstractInputSuggest, app }
      : undefined,
    enabled: o.enabled,
    write: value => commit(() => { o.model.setProperty(row.key, value); }),
  });

  const cardinality = itemRow(detail, {
    name: say("YAML_KIND_NAME"),
    desc: say("YAML_KIND_DESC"),
    tip: say("YAML_KIND_TIP"),
    tipId: "io-field-yaml-type-tip",
    showTips: o.showTips, showIds: o.showIds,
  });
  closers.push(cardinality.closeTip);
  const holds = selectInput(cardinality.control, "io-select", {
    options: CARDINALITY_OPTIONS,
    value: mine ? mine.cardinality : "auto",
    label: say("YAML_KIND_NAME") + " for " + row.strictName,
  });
  holds.disabled = !o.enabled;
  holds.addEventListener("change", (() => {
    if (!o.enabled) return;
    commit(() => { o.model.setYamlCardinality(row.key, holds.value); });
  }) as never);

  const rule = itemRow(detail, {
    name: say("YAML_FORM_NAME"),
    desc: say("YAML_FORM_DESC"),
    tip: say("YAML_FORM_TIP"),
    tipId: "io-field-yaml-rule-tip",
    showTips: o.showTips, showIds: o.showIds,
  });
  closers.push(rule.closeTip);
  const ruleSelect = selectInput(rule.control, "io-select", {
    options: VALUE_RULE_OPTIONS,
    value: mine ? mine.valueRule : "raw",
    label: say("YAML_FORM_NAME") + " for " + row.strictName,
  });
  ruleSelect.disabled = !o.enabled;
  ruleSelect.addEventListener("change", (() => {
    if (!o.enabled) return;
    commit(() => { o.model.setYamlValueRule(row.key, ruleSelect.value); });
  }) as never);

  /* Навигатор ребёнка — в свойство родителя (В-224, PRD 10.13.272); ряд только у навигатора (З8). */
  if (row.subKey && o.model.getSubNavigator(row.subKey)) {
    const navYaml = o.model.getYamlNavigator(row.subKey);
    const navRow = itemRow(detail, {
      name: say("YAML_NAV_NAME"),
      desc: say("YAML_NAV_DESC"),
      tip: say("YAML_NAV_TIP"),
      tipId: "io-field-yaml-navigator-tip",
      showTips: o.showTips, showIds: o.showIds,
    });
    closers.push(navRow.closeTip);
    const navPick = selectInput(navRow.control, "io-select", {
      options: labelled(say, CHILD_NAV_OPTIONS),
      value: navYaml ? "on" : "off",
      label: say("YAML_NAV_OF", row.strictName),
    });
    navPick.disabled = !o.enabled;
    navPick.addEventListener("change", (() => {
      if (!o.enabled) return;
      if ((navPick.value === "on") === navYaml) return;
      commit(() => { o.model.setYamlNavigator(row.subKey, navPick.value === "on"); });
    }) as never);
  }

  /* Link как MOC (тест 3 цикла 98): `no` — без backlinks; ряд только у Link (З8). */
  if (row.kind === "wikilink") {
    const moc = o.model.getUseAsMoc(row.key);
    const mocRow = itemRow(detail, {
      name: say("MOC_NAME"),
      desc: say("MOC_DESC"),
      tip: say("MOC_TIP"),
      tipId: "io-field-moc-tip",
      showTips: o.showTips, showIds: o.showIds,
    });
    closers.push(mocRow.closeTip);
    const mocPick = selectInput(mocRow.control, "io-select", {
      options: labelled(say, MOC_OPTIONS),
      value: moc ? "yes" : "no",
      label: say("MOC_OF", row.strictName),
    });
    mocPick.disabled = !o.enabled;
    mocPick.addEventListener("change", (() => {
      if (!o.enabled) return;
      if ((mocPick.value === "yes") === moc) return;
      commit(() => { o.model.setUseAsMoc(row.key, mocPick.value === "yes"); });
    }) as never);
  }

  if (cfg) {
    /* Превью справа, шириной поля свойства (2026-08-28): рамка, моноширинный, перенос внутри. */
    const written = itemRow(detail, {
      name: say("YAML_PREVIEW_NAME"),
      desc: say("YAML_PREVIEW_DESC"),
      tip: say("YAML_PREVIEW_TIP"),
      tipId: "io-field-yaml-written-tip",
      showTips: o.showTips, showIds: o.showIds,
    });
    closers.push(written.closeTip);
    const example = yamlExamples(rows, cfg, app)[row.key] || "";
    const box = el(written.control, "div", "io-yamlex" + (example ? "" : " io-yamlex--empty"));
    el(box, "div", "io-yamlex__line", example || NOT_WRITTEN);
  }

  return () => { closers.forEach(fn => fn()); };
}

/* ---- таблица Values (Ф7–Ф10) ------------------------------------------ */

/** Плоский список строк таблицы: значение, за ним его дочерние (Ф8). */
function flatten(tree: readonly ValueTreeRow[]): Array<{ row: ValueTreeRow; at: ValueAt }> {
  const out: Array<{ row: ValueTreeRow; at: ValueAt }> = [];
  for (const parent of tree) {
    out.push({ row: parent, at: { level: 0, token: parent.token, parentToken: "" } });
    for (const child of parent.children || []) {
      out.push({ row: child, at: { level: 1, token: child.token, parentToken: parent.token } });
    }
  }
  return out;
}

/**
 * Цвета пузыря без своих — как `.io-bubble` (`styles.css`) и
 * `TagVisualTokenWidget`. Пусто — тему не прочесть (заглушка DOM), контраст не считается.
 */
/* «Значение без оформления» — одно объявление в `preview_data.ts` (10.13.140). */
const plain = bareToken;

/** Колонка `Preview`: Value как в строке и значок нечитаемости (Н15–Н18); кодом живых предпросмотров (П9). */
function previewCell(host: El, o: FieldsViewOpts, theme: ThemePair, v: {
  token: string;
  fill: string;
  text: string;
  side: string;
  shown: ValueVisibility;
  custom: string;
}): El {
  const cell = el(host, "div", "io-vals__prev");
  applyTagVars(cell, o.ctx);
  const drawn = bubble(cell, {
    token: plain(v.token),
    fill: v.fill,
    text: v.text,
    side: v.side,
    shown: v.shown === "default" ? "value" : v.shown,
    custom: v.custom,
    depth: 0,
  });
  /* У пустого Value текста нет, читать нечего (Н18). */
  if (v.shown === "empty") return drawn;
  /* Сравниваются цвета, которыми Value нарисован: незаданный — цвет темы, а не «нет цвета». */
  const ratio = contrastRatio(v.fill || theme.fill, v.text || (v.fill ? theme.onFill : theme.text));
  if (ratio >= CONTRAST_FLOOR) return drawn;
  const warn = el(cell, "span", "io-warn", "\u26A0");
  /* Одна подсказка на узел — и только `aria-label`: `title` рисует вторую. */
  /* Слова предупреждения — из каталога, числа подставляет `contrastWarning` (A46). */
  const note = contrastWarning(ratio, frame(o.ctx, "CONTRAST_WARNING"));
  warn.setAttribute("aria-label", note);
  return drawn;
}

/**
 * Таблица Values (Ф7): ручка, `Level`, `Value`, `Prefix`, `Show`, `Fill`,
 * `Text`, `Preview`, удаление. У `link` нет колонок цвета.
 */
export function renderValuesTable(host: El, row: FieldRow, o: FieldsViewOpts): () => void {
  const say = words(o);
  const ve: ValuesEditor = o.model.valuesEditor(row.key);
  /* Один раз на таблицу: чтение темы трогает раскладку. */
  const theme = themePair(host);
  const isLink = ve.kind === "wikilink";
  const closers: Array<() => void> = [];

  const head = el(host, "div", "io-sub io-item__namerow");
  el(head, "span", undefined, "Values");
  const headTip = el(host, "div", "io-tiphost");
  closers.push(tipBelow({
    head,
    host: headTip,
    text: say("VALUES_TIP"),
    label: "Values",
    id: "io-values-tip",
    showTips: o.showTips, showIds: o.showIds,
  }));
  /* Тело раздела: его и прячет знак сворачивания (`З-34`). */
  const sec = el(host, "div", "io-fields__sec");
  foldableSub(head, sec, "values", "Values", headTip);

  const box = el(sec, "div", "io-vals" + (isLink ? " io-vals--link" : ""));
  const scroll = el(box, "div", "io-scroll");
  const inner = el(scroll, "div", "io-vals__inner" + (isLink ? " io-vals__inner--link" : ""));

  const headRow = el(inner, "div", "io-vals__head");
  /* Слот подсказок колонок — за шапкой, во всю ширину; пустой места не занимает. */
  const colTips = el(inner, "div", "io-vals__tipslot");
  /* У ссылки те же колонки без цвета, `Level` есть: `saveTree` пишет дочерние значения `wikilink`. */
  const columns = isLink
    ? ["", "Level", "Value", "Prefix", "Show", ""]
    : ["", "Level", "Value", "Prefix", "Show", "Fill", "Text", "Side", "Preview", ""];
  const tips = columnTips(isLink);
  for (const title of columns) {
    const cell = el(headRow, "div", "io-vals__col");
    el(cell, "span", "io-vals__coltext", title);
    const name = tips[title];
    if (!name) continue;
    closers.push(tipBelow({
      head: cell,
      host: colTips,
      text: say(name),
      label: title,
      id: "io-values-col-" + title.toLowerCase() + "-tip",
      showTips: o.showTips, showIds: o.showIds,
    }));
  }

  const rows = flatten(ve.tree);
  if (!rows.length) {
    /* Пустая таблица говорит, что нажать (ПЗ2, ПЗ3). */
    el(box, "div", "io-side__empty", say("VALUES_EMPTY"));
  }

  /* Что тянут: адрес строки переживает перерисовку, узел — нет. */
  let dragged: ValueAt | null = null;

  rows.forEach(({ row: v, at }) => {
    const line = el(inner, "div", "io-vals__row" + (at.level ? " io-vals__row--child" : "") + (v.hidden ? " io-vals__row--hidden" : ""));

    const grip = el(line, "div", "io-grip", "\u283F");
    grip.setAttribute("role", "button");
    grip.setAttribute("aria-label", say("VALUE_DRAG", v.token));
    grip.draggable = o.enabled;
    grip.addEventListener("dragstart", ((ev: DragEv) => {
      dragged = at;
      line.classList.add("io-dragging");
      try { ev.dataTransfer?.setData("text/plain", at.token); } catch { /* проба: десктоп всегда даёт dataTransfer */ }
    }) as never);
    grip.addEventListener("dragend", (() => {
      line.classList.remove("io-dragging");
      dragged = null;
    }) as never);
    line.addEventListener("dragover", ((ev: DragEv) => {
      ev.preventDefault();
      line.classList.add("io-dragover");
    }) as never);
    line.addEventListener("dragleave", (() => line.classList.remove("io-dragover")) as never);
    line.addEventListener("drop", ((ev: DragEv) => {
      ev.preventDefault();
      line.classList.remove("io-dragover");
      if (!dragged || !o.enabled) return;
      const next = ve.reorder(
        dragged.level, dragged.parentToken, dragged.token,
        at.level, at.parentToken, at.token,
      );
      if (!next) return;
      ve.saveTree(next, "pkm:behavior:order:deep:drag-reorder:" + row.key);
      o.redraw();
    }) as never);

    /* Ф8: стрелка вниз — дочерним к верхнему, вверх — на верхний уровень; у первого выключена. */
    {
      const depth = el(line, "div", "io-depthcell");
      const child = at.level === 1;
      const arrow = btn(depth, "io-icon", {
        text: child ? "\u2190" : "\u2192",
        label: say(child ? "VALUE_MAKE_PARENT" : "VALUE_MAKE_CHILD", v.token),
      });
      const firstOfAll = !child && ve.tree.length > 0 && ve.tree[0]?.token === v.token;
      arrow.disabled = !o.enabled || (!child && firstOfAll);
      arrow.addEventListener("click", (() => {
        if (arrow.disabled) return;
        ve.saveTree(ve.toggleLevel(ve.tree, at), "pkm:behavior:order:deep:indent:" + row.key);
        o.redraw();
      }) as never);
    }

    const valueCell = el(line, "div", "io-valcell");
    const token = textInput(valueCell, "io-text io-text--mono", {
      value: v.token,
      label: "Value " + v.token + " of " + row.strictName,
    });
    token.disabled = !o.enabled;
    /* Глаз — в ячейке Value, а не своей колонкой: таблице не осталось ширины (В-278, бюджет 665px); в DOM — за полем, на экране — перед ним. */
    const eye = btn(valueCell, "io-icon io-eye io-vals__eye" + (v.hidden ? " io-eye--off io-vals__eye--off" : ""), {
      label: say(v.hidden ? "VALUE_SHOW" : "VALUE_HIDE", v.token),
    });
    eye.setAttribute("aria-pressed", v.hidden ? "false" : "true");
    eye.disabled = !o.enabled;
    eye.addEventListener("click", (() => {
      if (!o.enabled) return;
      ve.saveTree(ve.editRow(ve.tree, at, { hidden: !v.hidden }), "pkm:behavior:order:deep:hide:" + row.key);
      o.redraw();
    }) as never);
    const applyName = (name: string): void => {
      const res = ve.saveTree(ve.editRow(ve.tree, at, { token: name }),
        "pkm:behavior:order:deep:rename:" + row.key);
      /* Отказ говорит словами: прежде поле молча возвращало старое имя (BUGHUNT 2026-09-30, A11). */
      if (!res.ok && res.error) o.notice(res.error);
      o.redraw();
    };
    /* Окно цены — с первой буквы: `change` от ухода фокуса в окно его не зовёт (тест 2 цикла 98). */
    let asking = false;
    /* Скобки ссылки на время правки уходят (тест 2 цикла 99); набранные свои — как есть. */
    const wrapped = isLink && isWrappedLink(v.token);
    let bareShown = false;
    const typedToken = (): string => linkTokenOfTyped(String(token.value || ""), bareShown);
    token.addEventListener("focus", (() => {
      if (!wrapped || bareShown || token.disabled) return;
      bareShown = true;
      token.value = linkShownForEdit(v.token);
    }) as never);
    token.addEventListener("blur", (() => {
      if (!bareShown) return;
      const full = typedToken();
      bareShown = false;
      token.value = full.trim() ? full : v.token;
    }) as never);
    const revertName = (): void => { asking = false; bareShown = false; token.value = v.token; };
    token.addEventListener("input", (() => {
      if (!o.enabled || !isLink || !o.askLinkValueRename || asking) return;
      const next = typedToken();
      if (!next.trim() || next === v.token) return;
      /* Флаг — до зова: окно снимает фокус, и `change` приходит раньше возврата. */
      asking = true;
      asking = o.askLinkValueRename(v.token, next, name => { asking = false; applyName(name); }, revertName, true);
    }) as never);
    token.addEventListener("change", (() => {
      if (!o.enabled || asking) return;
      if (isLink && o.askLinkValueRename) {
        o.askLinkValueRename(v.token, typedToken(), applyName, revertName);
        return;
      }
      applyName(typedToken());
    }) as never);

    /* Колонки `Parent` нет: `__ioParentBinding` движок не читает (PRD, фаза 3b). */

    /* `Prefix` — чекбокс перед строкой; пусто — обычный маркер. */
    const prefix = textInput(line, "io-text io-text--mono", {
      value: String(v.prefixMode === "checkbox" ? v.checkboxToken || "" : ""),
      placeholder: say("VALUE_PREFIX_NO"),
      label: say("VALUE_PREFIX_FOR", v.token),
    });
    prefix.disabled = !o.enabled;
    const commitPrefix = (): void => {
      if (!o.enabled) return;
      const raw = String(prefix.value || "").trim();
      if (!raw) {
        ve.saveTree(ve.editRow(ve.tree, at, { prefixMode: "bullet", checkboxToken: "" }),
          "pkm:behavior:order:deep:prefix-mode:" + row.key);
        o.redraw();
        return;
      }
      const cb = ve.normalizeCheckbox(raw);
      if (!cb) {
        o.notice(say("ERR_PREFIX_TOKEN"));
        prefix.value = String(v.checkboxToken || "");
        return;
      }
      ve.saveTree(ve.editRow(ve.tree, at, { prefixMode: "checkbox", checkboxToken: cb }),
        "pkm:behavior:order:deep:checkbox:" + row.key);
      o.redraw();
    };
    prefix.addEventListener("change", commitPrefix as never);
    /* Щелчок — выбиралка чекбоксов в теме (2026-09-28); пишется тем же путём. */
    if (o.enabled) {
      closers.push(attachPrefixPicker(prefix, line, {
        say, sample: bareToken(v.token),
        ...(o.holdKeys ? { holdKeys: o.holdKeys } : {}),
        onPick: token => { prefix.value = token; commitPrefix(); },
      }).close);
    }

    {
      /*
       * `Show` одним объявлением у обоих родов (2026-09-20 п.14): у ссылки два
       * положения и скобочный ключ слоя оформления. Цвет читается и пишется по
       * Field, не по уровню — дочернее хранит цвет у родителя.
       */
      const fieldId = ve.parentFieldId || row.strictName;
      const visualToken = isLink ? String(sharedUtils.wikilinkVisualToken(v.token) || "") : v.token;
      const visual = o.model.getValueVisual(fieldId, visualToken);
      /* `Empty` у ссылки нет; правленный руками конфиг не показывает его выбранным — рисуется как `default`. */
      const shownValue = isLink && visual.visibility === "empty" ? "default" : visual.visibility;

      const shownCell = el(line, "div", "io-showncell");
      const shown = selectInput(shownCell, "io-select", {
        options: labelled(say, isLink ? LINK_SHOWN_OPTIONS : SHOWN_OPTIONS),
        value: shownValue,
        label: say("VALUE_SHOWN_FOR", v.token),
      });
      shown.disabled = !o.enabled;
      shown.addEventListener("change", (() => {
        if (!o.enabled) return;
        o.model.setValueVisual(fieldId, visualToken, { visibility: shown.value as ValueVisibility },
          "pkm:visuals:tag:visibility:" + fieldId);
        o.redraw();
      }) as never);
      /* Пузырь `Preview` рисуется ниже, нужен обработчику выше — ссылкой. */
      let previewBubble: El | null = null;
      if (shownValue === "custom") {
        const custom = textInput(shownCell, "io-text io-text--mono", {
          value: visual.customText,
          placeholder: say("VALUE_CUSTOM_PLACEHOLDER"),
          label: say("VALUE_CUSTOM_FOR", v.token),
        });
        custom.disabled = !o.enabled;
        /*
         * На `input` меняется одна подпись `Preview` (2026-09-07); перерисовка унесла
         * бы каретку (У-20), запись на букву — A9. Конфиг — по `change`.
         */
        custom.addEventListener("input", (() => {
          if (!o.enabled || !previewBubble) return;
          previewBubble.textContent = bubbleLabel({
            token: plain(v.token),
            fill: visual.fillColor,
            text: visual.textColor,
            shown: "custom",
            custom: custom.value,
            depth: 0,
          });
        }) as never);
        custom.addEventListener("change", (() => {
          if (!o.enabled) return;
          o.model.setValueVisual(fieldId, visualToken, { customText: custom.value },
            "pkm:visuals:tag:custom-text:" + fieldId);
        }) as never);
      }

      /* Цвета и образец — только у тега: ссылку красит тема. */
      const color = (key: "fillColor" | "textColor" | "borderColor", label: string, reason: string): void => {
        const wrap = el(line, "div");
        /*
         * Без своего цвета образец — цвет темы (C31, C39), тем же помощником и
         * `toHexColor`. Белый — запасной для заглушки DOM.
         */
        const own = visual[key];
        const fromTheme = toHexColor(key === "fillColor" ? theme.fill : key === "textColor" ? (visual.fillColor ? theme.onFill : theme.text) : theme.side);
        const input = wrap.createEl("input", {
          cls: "io-colin",
          type: "color",
          value: own || fromTheme || "#ffffff",
          attr: { "aria-label": label + " for " + v.token },
        }) as ElInput;
        input.disabled = !o.enabled;
        input.addEventListener("change", (() => {
          if (!o.enabled) return;
          o.model.setValueVisual(fieldId, v.token, { [key]: input.value }, reason + ":" + fieldId);
          o.redraw();
        }) as never);
      };
      if (!isLink) {
        color("fillColor", say("VALUE_FILL_COLOR"), "pkm:visuals:tag:fill");
        color("textColor", say("VALUE_TEXT_COLOR"), "pkm:visuals:tag:text");
        color("borderColor", say("VALUE_SIDE_COLOR"), "pkm:visuals:tag:side");

        previewBubble = previewCell(line, o, theme, {
          token: v.token,
          fill: visual.fillColor,
          text: visual.textColor,
          side: visual.borderColor,
          shown: visual.visibility,
          custom: visual.customText,
        });
      }
    }

    const tools = el(line, "div", "io-valtools");
    /*
     * \u041e\u0431\u0440\u0430\u0442\u043d\u043e \u043a \u0446\u0432\u0435\u0442\u0443 \u0442\u0435\u043c\u044b. \u041f\u0438\u043a\u0435\u0440 \u0442\u0430\u043a\u043e\u0433\u043e \u0441\u043a\u0430\u0437\u0430\u0442\u044c \u043d\u0435 \u0443\u043c\u0435\u0435\u0442 \u2014 \u0443 \u043d\u0435\u0433\u043e \u0432\u0441\u0435\u0433\u0434\u0430
     * \u043a\u0430\u043a\u043e\u0439-\u0442\u043e \u0446\u0432\u0435\u0442, \u2014 \u0438 \u0431\u0435\u0437 \u044d\u0442\u043e\u0439 \u043a\u043d\u043e\u043f\u043a\u0438 \u0432\u044b\u0431\u0440\u0430\u043d\u043d\u044b\u0439 \u043e\u0434\u043d\u0430\u0436\u0434\u044b \u0446\u0432\u0435\u0442 \u043e\u0441\u0442\u0430\u0432\u0430\u043b\u0441\u044f \u0443
     * Value \u043d\u0430\u0432\u0441\u0435\u0433\u0434\u0430: \u043f\u0440\u0438 \u0441\u043c\u0435\u043d\u0435 \u0442\u0435\u043c\u044b \u043e\u043d \u0431\u043e\u043b\u044c\u0448\u0435 \u043d\u0435 \u043f\u043e\u0434\u0441\u0442\u0440\u0430\u0438\u0432\u0430\u043b\u0441\u044f. \u0412 \u0441\u0442\u0430\u0440\u043e\u0439
     * \u0434\u043e\u0441\u043a\u0435 \u044d\u0442\u043e \u0431\u044b\u043b\u0438 \u0434\u0432\u0435 \u043a\u043d\u043e\u043f\u043a\u0438 \u0443 \u043f\u0438\u043a\u0435\u0440\u043e\u0432, \u0437\u0434\u0435\u0441\u044c \u043e\u0434\u043d\u0430 \u043d\u0430 \u043e\u0431\u0430 \u0446\u0432\u0435\u0442\u0430 \u0438 \u043f\u0435\u0440\u0435\u0434
     * \u0443\u0434\u0430\u043b\u0435\u043d\u0438\u0435\u043c (\u0440\u0435\u0448\u0435\u043d\u0438\u0435 \u0437\u0430\u043a\u0430\u0437\u0447\u0438\u043a\u0430 2026-08-27).
     */
    if (!isLink) {
      const fieldId = ve.parentFieldId || row.strictName;
      const visual = o.model.getValueVisual(fieldId, v.token);
      if (visual.fillColor || visual.textColor || visual.borderColor) {
        const back = btn(tools, "io-icon", {
          text: "\u21ba",
          label: say("VALUE_RESET_COLORS", v.token),
        });
        back.disabled = !o.enabled;
        back.addEventListener("click", (() => {
          if (!o.enabled) return;
          o.model.setValueVisual(fieldId, v.token, { fillColor: "", textColor: "", borderColor: "" },
            "pkm:visuals:tag:color-reset:" + fieldId);
          o.redraw();
        }) as never);
      }
    }
    /* Удаление красное: уносит данные (2026-08-27). */
    const del = btn(tools, "io-icon io-icon--danger",
      { text: "\u2715", label: say("VALUE_REMOVE", v.token) });
    del.disabled = !o.enabled;
    del.addEventListener("click", (() => {
      if (!o.enabled) return;
      ve.saveTree(ve.removeRow(ve.tree, at), "pkm:behavior:order:deep:delete-token:" + row.key);
      o.redraw();
    }) as never);
  });

  const foot = el(box, "div", "io-vals__foot");
  /* Решётка и скобки необязательны (2026-08-27). */
  const add = textInput(foot, "io-text io-text--mono", {
    value: "",
    placeholder: say(isLink ? "NEW_VALUE_LINK_HINT" : "NEW_VALUE_TAG_HINT"),
    label: say("NEW_VALUE_FOR", row.strictName),
  });
  add.disabled = !o.enabled;
  /* Акцентная, как `Add Field`. */
  const addBtn = btn(foot, "io-btn io-btn--sm io-btn--cta",
    { text: say("ADD_VALUE"), label: say("ADD_VALUE_TO", row.strictName) });
  addBtn.disabled = !o.enabled;
  /* Enter в поле нового Value — то же, что кнопка (BUGHUNT S3). */
  onEnter(add, () => addValue());
  const addValue = (): void => {
    if (!o.enabled) return;
    const res = ve.addToken(add.value);
    if (res.error) {
      o.notice(res.error);
      return;
    }
    if (!res.ok) return;
    o.redraw();
  };
  addBtn.addEventListener("click", addValue as never);
  /* Link: щелчок — заметки vault, набор фильтрует, выбор встаёт в Values (тест 1 цикла 100). */
  if (isLink && o.enabled) {
    const app = o.ctx.platform ? (o.ctx.platform.plugin as { app?: unknown }).app : null;
    const vault = (app as { vault?: { getMarkdownFiles?: () => Array<{ path: string }> } } | null)?.vault;
    attachNoteSuggest(add, {
      platform: o.ctx.platform, app,
      notes: vault && typeof vault.getMarkdownFiles === "function" ? () => vault.getMarkdownFiles!().map(f => f.path) : undefined,
      pick: target => { add.value = target; addValue(); },
    });
  }
  /* \u0421\u0442\u0440\u043e\u043a\u0430 \u00abUse \u2192 to make a Value a child\u2026\u00bb \u0438\u0437 \u043f\u043e\u0434\u0432\u0430\u043b\u0430 \u0443\u0431\u0440\u0430\u043d\u0430: \u043e\u043d\u0430 \u0443\u0435\u0445\u0430\u043b\u0430 \u0432
     \u043f\u043e\u0434\u0441\u043a\u0430\u0437\u043a\u0443 \u043a\u043e\u043b\u043e\u043d\u043a\u0438 `Level`, \u0433\u0434\u0435 \u0435\u0451 \u0438\u0449\u0443\u0442 (\u0437\u0430\u043c\u0435\u0447\u0430\u043d\u0438\u0435 \u0437\u0430\u043a\u0430\u0437\u0447\u0438\u043a\u0430 2026-08-27). */

  return () => { closers.forEach(fn => fn()); };
}


/* ---- Command Field: категории и пресеты (постановка command-field.md, 4.1) ---- */

/**
 * Таблица категорий Command Field вместо Values: строка категории, под ней её
 * пресеты. Ручка, глаз, имя (пустое — имя по умолчанию), параметры, клон и
 * удаление; клон, совпавший с пресетом выше, помечен — перебор узнаёт первый
 * (В-281). Вся таблица — одна запись `setCommandCategories`. Вид — прототип,
 * `commandCategoriesTable`.
 */
export function renderCommandCategories(host: El, row: FieldRow, o: FieldsViewOpts): () => void {
  const say = words(o);
  const closers: Array<() => void> = [];
  const cats: CommandCategory[] = o.model.getCommandCategories(row.key);

  const head = el(host, "div", "io-sub io-item__namerow");
  el(head, "span", undefined, say("CATS_HEAD"));
  const headTip = el(host, "div", "io-tiphost");
  closers.push(tipBelow({
    head, host: headTip, text: say("CATS_TIP"), label: say("CATS_HEAD"), id: "io-field-categories-tip",
    showTips: o.showTips, showIds: o.showIds,
  }));
  const sec = el(host, "div", "io-fields__sec");
  foldableSub(head, sec, "categories", say("CATS_HEAD"), headTip);
  closers.push(drawCategoriesTable(sec, cats, {
    say, enabled: o.enabled, showTips: o.showTips, showIds: o.showIds,
    lineFields: o.model.listLineFields(), fieldName: row.strictName,
    ...(o.ctx.platform ? { setIcon: o.ctx.platform.setIcon } : {}),
    save: () => { o.model.setCommandCategories(row.key, cats); o.redraw(); },
  }));
  return () => { closers.forEach(fn => fn()); };
}


/* ---- Field типа element (Ф6) -------------------------------------------- */

/** Как `next`/`previous` двигают элемент; значения конфига прежние (З1), подписи — 2026-08-27. */
const STEP_OPTIONS = [
  { value: "increment", name: "STEP_FIXED" },
  { value: "command", name: "STEP_COMMAND" },
  { value: "custom", name: "STEP_CUSTOM" },
  { value: "list", name: "STEP_LIST" },
] as const;

/*
 * Тексты строк Emoji (2026-08-27) по рантайму: маска знает `YYYY MM DD HH mm ss`
 * (`src/core/shared_utils.js`: `normalizeFormatMask`, `hasFormatTokens`); цифры —
 * счётчик (`parseNumericLiteralSpec`), с разделителями — `parseNumericPatternSpec`.
 */

/** Строки Field `element`: маркер, формат, шаг — под своим заголовком, не `Placement` (2026-08-27). */
export function renderElementRows(host: El, row: FieldRow, o: FieldsViewOpts): () => void {
  const say = words(o);
  const ed = o.model.elementEditor(row.key);
  const closers: Array<() => void> = [];

  const valueHead = el(host, "div", "io-sub io-item__namerow");
  el(valueHead, "span", undefined, "Value");
  const valueHeadTip = el(host, "div", "io-tiphost");
  closers.push(tipBelow({
    head: valueHead,
    host: valueHeadTip,
    text: say("ELEMENT_VALUE_TIP"),
    label: "Value",
    id: "io-element-value-tip",
    showTips: o.showTips, showIds: o.showIds,
  }));
  /* Тело раздела: его и прячет знак сворачивания (`З-34`). */
  const sec = el(host, "div", "io-fields__sec");
  foldableSub(valueHead, sec, "element-value", "Value", valueHeadTip);

  /** Строка с полем ввода; `needed` — пустое обводится красным (п.14, 2026-09-22). */
  const line = (name: string, desc: string, tip: string, tipId: string, value: string,
    placeholder: string, save: (v: string) => void, needed?: boolean): { input: ElInput; row: El } => {
    const item = itemRow(sec, { name, desc, tip, tipId, showTips: o.showTips, showIds: o.showIds });
    closers.push(item.closeTip);
    const input = textInput(item.control, "io-text io-text--mono", {
      value,
      placeholder,
      label: name + " for " + row.strictName,
      needed: needed === true,
    });
    input.disabled = !o.enabled;
    input.addEventListener("change", (() => {
      if (!o.enabled) return;
      save(input.value);
      o.redraw();
    }) as never);
    return { input, row: item.row };
  };

  /* Знак обязателен: пустой у `Due` (2026-09-22) не даёт открыть панель вовсе. */
  /* У списка знак и формат стоят в каждом Value, и этих строк нет (`В-247`). */
  const listMode = ed.mode === "list";
  const marker = listMode ? null : line(say("ELEMENT_EMOJI_NAME"), say("ELEMENT_EMOJI_DESC"), say("ELEMENT_EMOJI_TIP"), "io-element-marker-tip", ed.emoji,
    say("ELEMENT_EMOJI_HINT"), v => ed.setEmoji(v), true);
  /* Выбиралка эмодзи (`В-182`, п.10): одна вкладка — знак Field один символ; пишется путём ручного ввода. */
  if (o.enabled && marker) {
    const picker = attachPicker(marker.input, marker.row, {
      kinds: ["emoji"],
      say,
      ...(o.holdKeys ? { holdKeys: o.holdKeys } : {}),
      onPick: char => {
        ed.setEmoji(char);
        o.redraw();
      },
    });
    /* Перерисовка снимает строку — выбиралка обязана отдать `Escape`. */
    closers.push(picker.close);
  }
  if (!listMode) {
    line(say("ELEMENT_FORMAT_NAME"), say("ELEMENT_FORMAT_DESC"), say("ELEMENT_FORMAT_TIP"), "io-element-format-tip", ed.format,
      say("ELEMENT_FORMAT_HINT"), v => ed.setFormat(v));
  }

  const steps = itemRow(sec, {
    name: say("ELEMENT_STEP_NAME"),
    desc: say("ELEMENT_STEP_DESC"),
    tip: say("ELEMENT_STEP_TIP"),
    tipId: "io-element-step-tip",
    showTips: o.showTips, showIds: o.showIds,
  });
  closers.push(steps.closeTip);
  const mode = selectInput(steps.control, "io-select", {
    options: labelled(say, STEP_OPTIONS),
    value: ed.mode,
    label: say("ELEMENT_STEP_FOR", row.strictName),
  });
  mode.disabled = !o.enabled;
  mode.addEventListener("change", (() => {
    if (!o.enabled) return;
    ed.setMode(mode.value);
    o.redraw();
  }) as never);

  /* Только поля этого режима шага. */
  if (ed.mode === "increment") {
    const by = itemRow(sec, {
      name: say("ELEMENT_AMOUNT_NAME"),
      desc: say("ELEMENT_AMOUNT_DESC"),
      tip: say("ELEMENT_AMOUNT_TIP"),
      tipId: "io-element-amount-tip",
      showTips: o.showTips, showIds: o.showIds,
    });
    closers.push(by.closeTip);
    const input = textInput(by.control, "io-text io-text--mono", {
      value: String(ed.incrementBy),
      label: say("ELEMENT_AMOUNT_FOR", row.strictName),
    });
    input.disabled = !o.enabled;
    input.addEventListener("change", (() => {
      if (!o.enabled) return;
      ed.setIncrementBy(Number(input.value || 1));
    }) as never);
  } else if (ed.mode === "command") {
    const cmd = itemRow(sec, {
      name: say("ELEMENT_COMMAND_NAME"),
      desc: say("ELEMENT_COMMAND_DESC"),
      tip: say("ELEMENT_COMMAND_TIP"),
      tipId: "io-element-command-tip",
      showTips: o.showTips, showIds: o.showIds,
    });
    closers.push(cmd.closeTip);
    const pick = selectInput(cmd.control, "io-select", {
      options: [
        { value: "now", label: say("COMMAND_NOW") },
        { value: "randomN", label: say("COMMAND_RANDOM_NUMBERS") },
        { value: "randomE", label: say("COMMAND_RANDOM_CHARS") },
      ],
      value: ed.command,
      label: say("ELEMENT_COMMAND_FOR", row.strictName),
    });
    pick.disabled = !o.enabled;
    pick.addEventListener("change", (() => {
      if (!o.enabled) return;
      ed.setCommand(pick.value);
    }) as never);
  } else if (listMode) {
    /* Имя и описание — над строками; строки Value в рамке, как таблица тега (тест 1 цикла 105). */
    const own = el(sec, "div", "io-item io-item--stack");
    const nameRow = el(own, "div", "io-item__namerow");
    el(nameRow, "div", "io-item__name", say("ELEMENT_LIST_NAME"));
    closers.push(tipBelow({
      head: nameRow, host: own, afterHead: true,
      text: say("ELEMENT_LIST_TIP"), label: say("ELEMENT_LIST_NAME"), id: "io-element-list-tip",
      showTips: o.showTips, showIds: o.showIds,
    }));
    rich(el(own, "div", "io-item__desc"), say("ELEMENT_LIST_DESC"));
    /* Строка на Value и `Add Value` внизу; выбиралка Binder у каждого поля (тест 4 цикла 104), знак встаёт у каретки. */
    const values = ed.list.slice();
    const hidden = ed.listHidden.slice();
    const save = (): void => {
      const res = ed.setList(values.join("\n"), hidden);
      if (!res.ok && res.error) o.notice(res.error);
      o.redraw();
    };
    const withPicker = (input: ElInput, host: El, picked: () => void): void => {
      if (!o.enabled) return;
      const picker = attachPicker(input, host, {
        kinds: PICK_ALL,
        say,
        ...(o.holdKeys ? { holdKeys: o.holdKeys } : {}),
        onPick: char => { insertAtCaret(input, char); picked(); },
      });
      closers.push(picker.close);
    };
    const box = el(own, "div", "io-vals io-elist");
    const held: DragHold = { taken: null };
    values.forEach((token, i) => {
      const off = hidden.includes(token);
      const item = el(box, "div", "io-elist__row" + (off ? " io-elist__row--hidden" : ""));
      attachRowDrag({
        row: item, index: i, label: say("VALUE_DRAG", token), enabled: o.enabled, held,
        /* Встаёт на место той строки, на которую бросили: как у таблицы тега. */
        onMove: (from, to) => { values.splice(to, 0, ...values.splice(from, 1)); save(); },
      });
      /* Глаз (В-278 «у всех Fields»): как у таблицы тега, перед полем Value. */
      const eye = btn(item, "io-icon io-eye io-elist__eye" + (off ? " io-eye--off" : ""), {
        label: say(off ? "VALUE_SHOW" : "VALUE_HIDE", token),
      });
      eye.setAttribute("aria-pressed", String(!off));
      eye.disabled = !o.enabled;
      eye.addEventListener("click", (() => {
        if (!o.enabled) return;
        ed.setListHidden(off ? hidden.filter(t => t !== token) : hidden.concat(token));
        o.redraw();
      }) as never);
      const input = textInput(item, "io-text io-text--mono", { value: token, label: say("ELEMENT_LIST_FOR", row.strictName) });
      input.disabled = !o.enabled;
      const put = (): void => {
        if (!o.enabled) return;
        const next = String(input.value || "").trim();
        /* Переименованное остаётся спрятанным. */
        const at = hidden.indexOf(token);
        if (at !== -1) hidden[at] = next;
        values[i] = next;
        save();
      };
      input.addEventListener("change", put as never);
      const del = btn(item, "io-icon io-icon--danger", { text: "✕", label: say("VALUE_REMOVE", token) });
      del.disabled = !o.enabled;
      del.addEventListener("click", (() => {
        if (!o.enabled) return;
        values.splice(i, 1);
        save();
      }) as never);
      withPicker(input, item, put);
    });
    const foot = el(box, "div", "io-elist__row io-elist__foot");
    const add = textInput(foot, "io-text io-text--mono", {
      value: "", placeholder: say("NEW_VALUE_LIST_HINT"), label: say("NEW_VALUE_FOR", row.strictName),
    });
    add.disabled = !o.enabled;
    const addBtn = btn(foot, "io-btn io-btn--sm io-btn--cta", { text: say("ADD_VALUE"), label: say("ADD_VALUE_TO", row.strictName) });
    addBtn.disabled = !o.enabled;
    const addValue = (): void => {
      const t = String(add.value || "").trim();
      if (!o.enabled || !t || values.includes(t)) return;
      values.push(t);
      save();
    };
    addBtn.addEventListener("click", addValue as never);
    onEnter(add, addValue);
    withPicker(add, foot, () => {
      const field = add as unknown as { focus?: () => void };
      if (typeof field.focus === "function") field.focus();
    });
  } else {
    const own = itemRow(sec, {
      name: say("ELEMENT_STEPS_NAME"),
      desc: say("ELEMENT_STEPS_DESC"),
      tip: say("ELEMENT_STEPS_TIP"),
      tipId: "io-element-steps-tip",
      showTips: o.showTips, showIds: o.showIds,
    });
    closers.push(own.closeTip);
    const area = own.control.createEl("textarea", {
      cls: "io-textarea",
      attr: { "aria-label": say("ELEMENT_STEPS_FOR", row.strictName), rows: "3" },
    }) as ElInput;
    area.value = ed.customRaw.join("\n");
    area.disabled = !o.enabled;
    area.addEventListener("change", (() => {
      if (!o.enabled) return;
      ed.setCustomRaw(area.value);
    }) as never);
  }

  return () => { closers.forEach(fn => fn()); };
}

/* ---- обе колонки ------------------------------------------------------- */

/**
 * Путь, на котором лежит высота таблицы Fields. Объявлен один раз: его
 * спрашивает вёрстка и его же пишет переключатель (У-32).
 */
/* Value-ссылка правится без скобок (тест 2 цикла 99) — одно правило на таблицу и окно цены. */
export const isWrappedLink = (token: string): boolean => /^\[\[[\s\S]*\]\]$/.test(String(token || ""));
export const linkShownForEdit = (token: string): string => (isWrappedLink(token) ? token.slice(2, -2) : token);
export function linkTokenOfTyped(raw: string, bare: boolean): string {
  if (!bare || !raw.trim() || /^\s*\[\[/.test(raw)) return raw;
  return "[[" + raw.trim() + "]]";
}

export const FIELDS_HEIGHT_PATH = "ui.fieldsTableFixedHeight";

/* Полоса прокрутки — при прокрутке и при наведении на правый край (2026-09-12): два независимых флага. */
const SCROLLER_ZONE_PX = 28;
const SCROLLER_FADE_MS = 900;

/** Геометрия узла: у заглушки DOM её нет вовсе, и это ответ, а не отказ. */
interface Measured {
  getBoundingClientRect?: () => { right: number };
}

/**
 * Полоса прокрутки при прокрутке и наведении. Возвращает уборку таймера.
 * Слушатели уходят с узлом: редактор перерисовывается подменой (`fields_editor.ts`).
 */
function revealScrollerOnDemand(wrap: El): () => void {
  let scrolling = false;
  let near = false;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let right = 0;

  const sync = (): void => {
    if (scrolling || near) wrap.classList.add("io-fields--scrollon");
    else wrap.classList.remove("io-fields--scrollon");
  };
  const measure = (): boolean => {
    const box = wrap as unknown as Measured;
    if (typeof box.getBoundingClientRect !== "function") return false;
    right = Number(box.getBoundingClientRect().right);
    return Number.isFinite(right);
  };

  wrap.addEventListener("scroll", (() => {
    scrolling = true;
    sync();
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => { scrolling = false; sync(); }, SCROLLER_FADE_MS);
  }) as never);

  /* Ширина меряется на входе мыши: прямоугольник — чтение вёрстки. */
  wrap.addEventListener("mouseenter", (() => { measure(); }) as never);
  wrap.addEventListener("mousemove", ((ev: { clientX?: number }) => {
    if (!right && !measure()) return;
    const x = Number(ev && ev.clientX);
    if (!Number.isFinite(x)) return;
    const next = x >= right - SCROLLER_ZONE_PX;
    if (next === near) return;
    near = next;
    sync();
  }) as never);
  wrap.addEventListener("mouseleave", (() => {
    if (!near) return;
    near = false;
    sync();
  }) as never);

  return () => { if (timer) clearTimeout(timer); timer = null; };
}

/** Подсказка списка: Blocks и Fields, у каждого значка строки — его смысл (его 💬 к тесту 1 цикла 131). */
function paintListLegend(open: El, say: Say): void {
  const box = el(open, "div", "io-legend");
  const part = (head: string): ((mark: (cell: El) => void, text: string) => void) => {
    const p = el(box, "div", "io-legend__part");
    rich(el(p, "div", "io-legend__head"), head);
    return (mark, text) => {
      mark(el(p, "span", "io-legend__mark"));
      rich(el(p, "span", "io-legend__text"), text);
    };
  };
  const word = (w: string) => (cell: El): void => { el(cell, "b", undefined, w); };
  const glyph = (g: string) => (cell: El): void => { el(cell, "span", undefined, g); };
  const tile = (kind: FieldKind) => (cell: El): void => {
    const t = el(cell, "span", "io-typedot io-typedot--" + kind, TYPE_GLYPH[kind]);
    cssVar(t, "--io-chip-bg", typeColor(kind));
    cssVar(t, "--io-chip-ink", typeInk(kind));
  };

  const blocks = part(say("LIST_TIP_BLOCKS"));
  blocks(word(say("SIDE_LEFT")), say("LEGEND_LEFT"));
  blocks(word(say("SIDE_RIGHT")), say("LEGEND_RIGHT"));
  blocks(word(say("LEGEND_CUSTOM_NAME")), say("LEGEND_CUSTOM"));
  blocks(glyph("✎"), say("LEGEND_RENAME"));
  blocks(cell => { el(cell, "span", "io-danger__icon"); cell.classList.add("io-legend__mark--danger"); }, say("LEGEND_DELETE"));

  const fields = part(say("LIST_TIP_FIELDS"));
  fields(glyph("⠿"), say("LEGEND_GRIP"));
  fields(glyph("↑ ↓"), say("LEGEND_ARROWS"));
  fields(tile("tag"), say("LEGEND_TAG"));
  fields(tile("wikilink"), say("LEGEND_LINK"));
  fields(tile("element"), say("LEGEND_EMOJI"));
  fields(tile("command"), say("LEGEND_ACTION"));
}

/** Редактор целиком. */
export function renderFieldsEditor(host: El, o: FieldsViewOpts): () => void {
  const say = words(o);
  /* Высота таблицы (2026-09-12): строго `=== true`, иначе прежний развёрнутый вид. */
  const fixedHeight = o.ctx.get(FIELDS_HEIGHT_PATH) === true;
  const wrap = el(host, "div", "io-fields" + (fixedHeight ? " io-fields--fixed" : ""));
  const closers: Array<() => void> = [];

  const rows = o.model.listFields();
  const key = selectedKey(rows, o.state);
  const row = rows.find(r => r.key === key) || null;

  /* Обе шапки в одной строке сетки, подсказки под ними во всю ширину (В-92); порядок узлов — порядок ячеек. */
  const listHead = el(wrap, "div", "io-fields__colhead");
  el(listHead, "span", undefined, "Fields");

  const detailHead = el(wrap, "div", "io-fields__colhead io-fields__colhead--detail");
  /* Шапка правой колонки — `Values` у всех типов (2026-09-13): называет колонку; тип — чипом. */
  el(detailHead, "span", undefined, "Values");

  closers.push(tipBelow({
    head: listHead,
    host: el(wrap, "div", "io-tiphost io-fields__tiprow"),
    text: say("LIST_TIP_FIELDS"),
    label: say("LIST_ARIA"),
    id: "io-fields-list-tip",
    showTips: o.showTips, showIds: o.showIds,
    paint: open => paintListLegend(open, say),
  }));
  /* «?» у шапки правой колонки (1.4.1.2.1). */
  closers.push(tipBelow({
    head: detailHead,
    host: el(wrap, "div", "io-tiphost io-fields__tiprow"),
    text: say("DETAIL_TIP"),
    label: say("COLUMN_ARIA"),
    id: "io-fields-detail-tip",
    showTips: o.showTips, showIds: o.showIds,
  }));

  /* Переключатель высоты — последним: `margin-left: auto`. Не выключается — меняет только высоту. */
  const height = btn(detailHead, "io-icon io-fields__height", {
    text: fixedHeight ? "▸" : "▾",
    label: say(fixedHeight ? "HEIGHT_EXPAND" : "HEIGHT_COLLAPSE"),
  });
  height.setAttribute("aria-pressed", fixedHeight ? "true" : "false");
  /* Перерисовка — от хранилища (У-22): запись асинхронна. */
  height.addEventListener("click", (() => {
    void o.ctx.set(FIELDS_HEIGHT_PATH, !fixedHeight);
  }) as never);

  if (fixedHeight) closers.push(revealScrollerOnDemand(wrap));

  const list = el(wrap, "div", "io-fields__list");
  renderFieldList(list, o);

  const detail = el(wrap, "div", "io-fields__detail");
  /* Ни одного Field — не ошибка, а приглашение (ПЗ2, ПЗ3). */
  if (row) closers.push(renderFieldDetail(detail, row, o));
  else el(detail, "div", "io-fields__hint", say("NO_FIELD_PICKED"));

  return () => {
    closers.forEach(fn => fn());
    wrap.remove();
  };
}
