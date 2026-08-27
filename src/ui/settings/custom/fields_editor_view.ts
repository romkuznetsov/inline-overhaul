/**
 * Редактор Fields, новая вёрстка (PRD 10.2, требования Ф1–Ф20).
 *
 * Две колонки под общей рамкой: слева список Fields, разделённый линией на
 * `Left Block` и `Right Block`, справа — выбранный Field. Геометрия и все
 * видимые тексты сняты с прототипа (Р8), поведение — из Ф1–Ф20.
 *
 * Записей в конфиг здесь нет ни одной. Всё, что меняет настройки, зовётся у
 * модели `fields_model.ts`, куда записи вынесены из доски дословно и где их
 * стережёт карта `tests/fixtures/order_board_write_map.txt`. Вёрстка,
 * собирающая патчи сама, эту карту обесценила бы за один коммит.
 *
 * Состояние вида — выбранный Field — живёт в памяти и в `data.json` не
 * пишется (О0).
 */

import type { El, ElButton, ElInput, DragEv } from "./dom.ts";
import { el, btn, cssVar, rich, selectInput, textInput, tipBelow } from "./dom.ts";
import type { FieldsModel, FieldRow, ValueAt, ValuesEditor, ValueTreeRow } from "./fields_model.ts";
import type { FieldKind, SettingsCtx, ValueVisibility } from "../types.ts";
import { CONTRAST_FLOOR, contrastRatio, contrastWarning } from "./contrast.ts";
import { applyTagVars, bubble } from "./previews.ts";

/* ---- тексты и цвета типов --------------------------------------------- */

/**
 * Подпись типа. В конфиге тип ссылки называется `wikilink`, а тип элемента —
 * `element`, и такими остаются (З1): меняются только видимые подписи.
 *
 * `Emoji` вместо `Element` — по замечанию заказчика 2026-08-27: чип шириной в
 * слово `Element` вместе со стрелками съедал имя Field в узкой левой колонке,
 * и «444» показывалось как «4...».
 */
const TYPE_LABEL: Record<FieldKind, string> = {
  tag: "Tag",
  wikilink: "Link",
  element: "Emoji",
};

/**
 * Цвет чипа типа (Ф4). Значения лежат в `styles.css` переменными: цвет типа
 * намеренно не совпадает с акцентом темы — акцент занят основными действиями,
 * — и потому не может быть взят из переменных Obsidian.
 */
const TYPE_COLOR: Record<FieldKind, string> = {
  tag: "var(--io-type-tag)",
  wikilink: "var(--io-type-link)",
  element: "var(--io-type-element)",
};

const SIDE_LABEL = { left: "Left Block", right: "Right Block" } as const;

const LIST_TIP =
  "Drag a Field across the line to change which Block it is written in, or step it with the arrows on the right — at the edge of a Block they cross the line too";

/** Пустая сторона — приглашение, а не ошибка (ПЗ2, ПЗ3). */
const EMPTY_SIDE = "nothing on this side";

const SHORT_NAME_TIP =
  "TagWheel puts every Field side by side, so a long name crowds its neighbours. "
  + "Writing <b>Status</b> as <b>Stat</b> keeps that row readable. Your notes keep the full name";

/**
 * Режим размещения. Значения в конфиге остаются прежними — `off`, `minimal`,
 * `full`, — меняются только подписи (З1). Настройка называется `freeRoam` в
 * конфиге и `Behavior` в панели.
 */
const BEHAVIOR_OPTIONS = [
  { value: "off", label: "Strict" },
  { value: "minimal", label: "Insert only" },
  { value: "full", label: "Free" },
] as const;

/** Ф10: порядок Values и есть порядок цикла. Сказано один раз, в шапке таблицы. */
const VALUES_TIP =
  "The <code>next</code> and <code>previous</code> commands walk this list in order. "
  + "A child Value follows its parent: it sits in the same Block and takes the parent\u2019s <code>Behavior</code>";

/** Ф9: как Value показывается в строке. Значения конфига прежние (З1). */
const SHOWN_OPTIONS = [
  { value: "default", label: "default" },
  { value: "empty", label: "empty" },
  { value: "custom", label: "custom" },
] as const;

const BEHAVIOR_NAME = "Prefix behavior";
const BEHAVIOR_DESC = "How this Field affects the line Prefix";

/**
 * Работает ли Field вообще. Настройка живая и читается рантаймом: при `no`
 * Field выключен везде, при `hotkey_only` его команды работают, а из TagWheel
 * он убран. Значения в конфиге прежние (З1), меняются подписи.
 *
 * Возвращена решением заказчика 2026-08-27. В первой версии этой колонки
 * контрола не было, и настройка становилась недостижимой: ветка
 * `pkm.behavior.order.active` переезжает миграцией 8.1 целиком, то есть
 * переживёт переезд и останется без единого способа её задать.
 */
const ACTIVE_NAME = "Active";
const ACTIVE_DESC = "Whether this Field is offered, and where";
const ACTIVE_TIP =
  "<b>No</b> switches the Field off everywhere: TagWheel does not show it and its commands do nothing. "
  + "<b>Commands only</b> keeps the commands working and takes the Field out of TagWheel";
const ACTIVE_OPTIONS = [
  { value: "yes", label: "Yes" },
  { value: "no", label: "No" },
  { value: "hotkey_only", label: "Commands only" },
] as const;

/**
 * Видимость дочернего Field. Ряд показывается у Field типа `tag` и `wikilink`
 * — у всех, у кого есть Values, а значит и дочерние Values. У `element`
 * Values нет, и переключать нечего (З8). Выключенный дочерний Field не
 * появляется в TagWheel после выбора родительского значения, даже если
 * значения у него заведены.
 *
 * Переключается тем же `toggleSub`, что и кнопка старой доски: у него две
 * записи и важен их порядок, и собирать их заново вёрстке нельзя.
 */
const CHILD_NAME = "Child Field";
const CHILD_DESC = "Show the child Field in TagWheel once a parent Value is picked";
const CHILD_TIP =
  "A child Field is a second Field that only makes sense under this one: its Values are "
  + "the ones marked child in the table below. "
  + "Switched off, TagWheel does not offer it even when its Values are set up";
const CHILD_OPTIONS = [
  { value: "yes", label: "Yes" },
  { value: "no", label: "No" },
] as const;

/**
 * Свойства заметки — свой раздел, а не строка внутри `Behavior` (замечание
 * заказчика 2026-08-27): сюда приедут остальные настройки свойства, когда
 * дойдёт черёд блока `Note properties` на вкладке Transform. Подсказка стоит у
 * заголовка раздела и объясняет, зачем он нужен вообще; у строки внутри
 * остаётся только описание, чтобы два «?» не стояли рядом.
 */
const PROPERTY_HEAD = "YAML property";
const PROPERTY_HEAD_TIP =
  "<code>Inline to note</code> on the Transform tab turns a line into a note, and every Field can "
  + "be written into a property of that note — the same properties you see at the top of a note in "
  + "Obsidian. This is where you say which property a Field goes to. Leave it empty and the Field "
  + "is simply not copied";
const PROPERTY_NAME = "Property";
const PROPERTY_DESC = "If you use inline2note, to which YAML property this Field should go";
/*
 * Пока в разделе одна настройка — имя свойства. Тип (одно значение или список)
 * и правило значения (сырое или очищенное) приедут сюда же вместе с блоком
 * `Note properties` на вкладке Transform (10.9): решение заказчика 2026-08-27.
 * Ради них раздел и сделан отдельным заголовком, а не строкой.
 */
const BEHAVIOR_TIP =
  "<b>Strict</b> writes the Value in its own Block and changes the line Prefix. "
  + "<b>Insert only</b> writes the Value in its own Block and does not change the line Prefix. "
  + "<b>Free</b> inserts the Value where the cursor is now";

/**
 * Подсказки колонок таблицы Values. Есть у каждой колонки, о которой человеку
 * есть что сказать; у `Fill`, `Text` и `Preview` подпись и есть объяснение.
 *
 * Знак «?» стоит ПОД текстом заголовка, а не справа: справа он наезжал на
 * соседнюю ячейку — колонки узкие (замечание заказчика 2026-08-27). Сама
 * подсказка раскрывается под шапкой во всю ширину таблицы: в ячейку шириной
 * в тридцать точек текст не встанет.
 */
function columnTips(isLink: boolean): Record<string, string> {
  return {
    /* Строка заказчика: она заменила подпись в подвале таблицы. */
    Level: "change Value to be parent or child by pressing arrows. "
      + "Child Values are only active when Parent Value is present",
    /* У ссылки своя запись значения, и подсказка говорит про неё, а не про тег
       (замечание заказчика 2026-08-27). */
    Value: isLink
      ? "The link this Value writes. It may be written as <code>[[link]]</code> or as "
        + "<code>link</code> — both are read the same way"
      : "The text of the Value. A tag may be written with <code>#</code> or without it "
        + "— both are read the same way",
    Prefix: "The checkbox this Value puts in front of the line, such as <code>[ ]</code> or "
      + "<code>[x]</code>. Empty leaves the usual list marker",
    Show: "How the Value looks in the line: <b>default</b> prints the Value, <b>empty</b> prints "
      + "its color and nothing else, <b>custom</b> prints the text you give",
  };
}

/* ---- то, с чем работает вёрстка --------------------------------------- */

/** Состояние вида. В конфиг не попадает (О0). */
export interface FieldsViewState {
  /** Ключ выбранного Field. Пустая строка — выбран первый по порядку. */
  selected: string;
}

/** Ответ окна `Add Field`. */
export interface NewField {
  /** Системное имя: им Field назван в конфиге и в заметке конфига. */
  name: string;
  kind: FieldKind;
}

export interface FieldsViewOpts {
  model: FieldsModel;
  /**
   * Настройки панели. Нужны колонке `Preview`: пузырь Value рисуется тем же
   * кодом, что и живые предпросмотры, а тому нужны размеры и прозрачность
   * тега (П9).
   */
  ctx: SettingsCtx;
  state: FieldsViewState;
  /** Модуль выключен: вёрстка показывается, но ничего не меняет. */
  enabled: boolean;
  showTips: boolean;
  /** Перерисовать редактор целиком: список зависит от порядка Fields. */
  redraw: () => void;
  /** Показать сообщение человеку. Текст приходит от модели, показывает панель. */
  notice: (text: string) => void;
  /**
   * Спросить имя и тип нового Field. Окно рисует панель, а не блок: `Modal`
   * принадлежит платформе, а блок про платформу знать не должен — иначе его
   * не отрисует заглушка гейта Г16. Ответ приходит обратным вызовом, как его
   * и отдаёт `Modal`; `null` — человек отказался.
   */
  askNewField: (done: (answer: NewField | null) => void) => void;
  /**
   * Спросить подтверждение удаления Field. Тоже окно платформы и тот же шов,
   * что у `askNewField`: удаление Field уносит с собой его Values, цвета и
   * свойство заметки, и переспросить дешевле, чем восстанавливать.
   */
  confirmDeleteField: (name: string, done: (yes: boolean) => void) => void;
}

/* ---- левая колонка: список Fields -------------------------------------- */

/**
 * Список Fields двумя сторонами (Ф1). Сторона строки и есть Block, в который
 * Field пишется: отдельной настройки «сторона» нет и быть не должно.
 */
export function renderFieldList(list: El, o: FieldsViewOpts): void {
  const rows = o.model.listFields();
  /*
   * Что тянут прямо сейчас. Ключ, а не строка: строку перерисует любая
   * правка, а ключ переживёт перерисовку. Дочерний Field отдаёт ключ
   * родителя — Block переносится целиком (Ф3).
   */
  let dragged = "";

  const ownerOf = (row: FieldRow): string => row.parent || row.key;

  const side = (value: "left" | "right"): void => {
    const sec = el(list, "div", "io-side");
    const cap = el(sec, "div", "io-side__cap");
    el(cap, "span", "io-side__label", SIDE_LABEL[value]);

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
    if (!mine.length) {
      el(sec, "div", "io-side__empty", EMPTY_SIDE);
      return;
    }

    for (const row of mine) {
      const item = el(sec, "div", "io-fields__item" + (row.parent ? " io-fields__item--child" : ""));
      const current = row.key === selectedKey(rows, o.state);
      /*
       * Строка — контейнер, а не кнопка (Ф19): внутри неё ручка, кнопка
       * выбора и две стрелки, и кнопка внутри кнопки для клавиатуры и
       * программы чтения с экрана слипается в один элемент.
       */
      item.setAttribute("aria-current", current ? "true" : "false");

      const grip = el(item, "span", "io-grip", "⠿");
      grip.setAttribute("role", "button");
      /* Одна подсказка на узел, и текст у неё один: Obsidian рисует
         `aria-label` своей подсказкой, а браузер поверх — `title`. */
      const gripLabel = row.parent
        ? "Drag " + row.label + " \u2014 it moves with " + parentLabel(rows, row.parent)
        : "Drag " + row.label + " to reorder it, or across the line to change side";
      grip.setAttribute("aria-label", gripLabel);
      grip.title = gripLabel;
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
        o.model.moveKey(row.side, dragged, before);
        o.redraw();
      }) as never);

      const pick = btn(item, "io-fields__pick", { label: "Show the Field " + row.label });
      el(pick, "span", "io-fields__name", row.label);
      cssVar(
        el(pick, "span", "io-chip io-chip--typed", TYPE_LABEL[row.kind]),
        "--io-chip-bg",
        TYPE_COLOR[row.kind],
      );
      pick.addEventListener("click", (() => {
        o.state.selected = row.key;
        o.redraw();
      }) as never);

      /*
       * Место под стрелки занято всегда, видны они только у строки, с
       * которой работают (Ф18): иначе появление кнопки двигает вёрстку под
       * курсором. У дочернего Field своих стрелок нет — он ходит за
       * родителем (Ф20).
       */
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
      arrow("↑", -1, "Move " + row.label + " up, and across the line at the top");
      arrow("↓", 1, "Move " + row.label + " down, and across the line at the bottom");
    }
  };

  side("left");
  el(list, "div", "io-side__rule");
  side("right");

  const addWrap = el(list, "div", "io-fields__add");
  /* Акцентная: заказчик просил, чтобы добавление было видно (замечание
     2026-08-27, отменяет прежнее «нейтральная» из Ф5). */
  const add = btn(addWrap, "io-btn io-btn--sm io-btn--cta", { text: "Add Field", label: "Add a Field" });
  add.disabled = !o.enabled;
  addFieldAction(add, o);
}

/**
 * Шаг Field стрелкой. На краю стороны шаг уводит Field через линию — без
 * этого сторону Field с клавиатуры не сменить вовсе (Ф17), а перетаскивание
 * мышью единственным путём быть не может.
 */
function stepField(model: FieldsModel, rows: readonly FieldRow[], row: FieldRow, dir: -1 | 1): void {
  const side = row.side;
  const peers = rows.filter(r => !r.parent && r.side === side).map(r => r.key);
  const i = peers.indexOf(row.key);
  const target = peers[i + dir];
  if (target) {
    if (dir < 0) model.moveKey(side, row.key, target);
    else if (peers[i + 2]) model.moveKey(side, row.key, peers[i + 2]);
    else model.moveKey(side, row.key);
    return;
  }
  /*
   * Край стороны. `Left Block` нарисован выше `Right Block`, и стрелка этому
   * подчиняется: вниз с низа левого попадаешь в начало правого, вверх с
   * верха правого — в конец левого.
   */
  const other = side === "left" ? "right" : "left";
  const there = rows.filter(r => !r.parent && r.side === other).map(r => r.key);
  if (dir > 0 && there[0]) model.moveKey(other, row.key, there[0]);
  else model.moveKey(other, row.key);
}

/**
 * Ключ выбранного Field. Пока не выбрали — первый по порядку: правая колонка
 * без выбранного Field показывала бы пустое место, а показывать нечего не
 * значит показывать ничего.
 */
export function selectedKey(rows: readonly FieldRow[], state: FieldsViewState): string {
  const top = rows.filter(r => !r.parent);
  if (state.selected && rows.some(r => r.key === state.selected)) return state.selected;
  return top.length ? (top[0] as FieldRow).key : "";
}

function parentLabel(rows: readonly FieldRow[], key: string): string {
  const found = rows.find(r => r.key === key);
  return found ? found.label : key;
}

/**
 * Добавление Field. Имя и тип спрашиваются окном (решение заказчика
 * 2026-08-27): тип выбирается один раз и потом не меняется — он решает, что
 * Field пишет в строку, — а угадать его за человека нельзя.
 */
function addFieldAction(button: ElButton, o: FieldsViewOpts): void {
  button.addEventListener("click", (() => {
    if (!o.enabled) return;
    o.askNewField(answer => {
      if (!answer) return;
      const res = o.model.addField(answer.name, answer.kind);
      if (!res.ok) {
        o.notice(res.error || "InlineOverhaul: field was not added");
        return;
      }
      /* Новый Field выбирается сразу: за добавлением идёт настройка. */
      if (res.key) o.state.selected = res.key;
      o.redraw();
    });
  }) as never);
}

/* ---- правая колонка: выбранный Field ----------------------------------- */

/**
 * Строка настройки внутри блока: имя, описание, подсказка, контрол справа.
 * Своя, а не платформенная: платформенный `Setting` рисует строку настройки
 * целиком, а мы уже внутри одной такой строки и рисуем её содержимое сами.
 */
function itemRow(host: El, o: {
  name: string;
  desc: string;
  tip?: string;
  tipId?: string;
  showTips: boolean;
}): { control: El; closeTip: () => void } {
  const row = el(host, "div", "io-item");
  const info = el(row, "div", "io-item__info");
  const nameRow = el(info, "div", "io-item__namerow");
  el(nameRow, "div", "io-item__name", o.name);
  const closeTip = o.tip && o.tipId
    ? tipBelow({ head: nameRow, host: info, text: o.tip, label: o.name, id: o.tipId, showTips: o.showTips })
    : () => {};
  rich(el(info, "div", "io-item__desc"), o.desc);
  return { control: el(row, "div", "io-item__control"), closeTip };
}

/**
 * Выбранный Field: как он называется, что он такое, как встаёт в строку и как
 * его убрать (Ф6). Таблица Values и строки `element` приезжают следующим
 * куском — они живут ниже по этой же колонке.
 */
export function renderFieldDetail(detail: El, row: FieldRow, o: FieldsViewOpts): () => void {
  const closers: Array<() => void> = [];

  /*
   * Шапка. Системное имя — заголовок, а не поле: оно задаётся один раз в окне
   * `Add Field` и дальше не меняется (решение заказчика 2026-08-27, пересмотр
   * того же дня). Причина: имя стоит в заметке конфига и в именах команд, а
   * поле ввода рядом с коротким именем оказалось широким и без описания —
   * `Delete Field` от него съезжал на строку ниже. Правится рядом короткое
   * имя, то, которое видно в TagWheel.
   */
  const title = el(detail, "div", "io-fields__title");
  el(title, "h4", undefined, row.strictName);
  cssVar(
    el(title, "span", "io-chip io-chip--typed", TYPE_LABEL[row.kind]),
    "--io-chip-bg",
    TYPE_COLOR[row.kind],
  );
  el(title, "span", "io-fields__shortlabel", "short name");
  /*
   * «?» стоит до поля ввода, а не после: подпись, знак вопроса, потом правка
   * — так это читается слева направо (замечание заказчика 2026-08-27).
   * Подсказка при этом открывается там же, где и раньше — сразу под строкой
   * заголовка, а не в конце колонки.
   */
  closers.push(tipBelow({
    head: title,
    host: el(detail, "div", "io-tipslot"),
    text: SHORT_NAME_TIP,
    label: "Short name",
    id: "io-field-short-tip",
    showTips: o.showTips,
  }));
  const short = textInput(title, "io-text io-text--short", {
    /* Пусто — значит короткого имени нет и в TagWheel стоит полное. */
    value: row.label === row.strictName ? "" : row.label,
    placeholder: row.strictName,
    label: "Short name for " + row.strictName,
  });
  short.disabled = !o.enabled;
  short.addEventListener("change", (() => {
    if (!o.enabled) return;
    /*
     * Пустое короткое имя не пишется. Так вела себя и старая доска, а Ф12
     * велит сохранить поведение: сбросить короткое имя обратно к полному
     * сейчас нечем, и это отдельный разговор, а не побочная правка вёрстки.
     */
    if (!String(short.value || "").trim()) return;
    o.model.setLabel(row.key, short.value);
    o.redraw();
  }) as never);

  /*
   * Удаление — белая корзина на красном, без слова (замечание заказчика
   * 2026-08-27): оно должно бросаться в глаза, а не притворяться обычной
   * кнопкой. Значок лежит своим узлом и обесцвечивается в белый фильтром:
   * эмодзи приходит со своими цветами, и на красной заливке цветная корзина
   * читается грязным пятном. Смысл кнопки несут `aria-label` и `title`.
   */
  const del = btn(title, "io-danger", {
    label: "Delete the Field " + row.strictName,
  });
  el(del, "span", "io-danger__icon", "🗑");
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

  /* Заголовок раздела — Behavior: под ним Active, Prefix behavior и
     Child Field (замечание заказчика 2026-08-27). */
  el(detail, "div", "io-sub", "Behavior");

  /*
   * Работает ли Field. У дочернего Field этого ряда нет намеренно: его
   * включает и выключает родитель рядом `Child Field` ниже, и делает это
   * `toggleSub` — двумя записями, а не одной. Две точки для одного и того же
   * — это две правды, и одна из них однажды окажется старой.
   */
  if (!row.parent) {
    const active = itemRow(detail, {
      name: ACTIVE_NAME,
      desc: ACTIVE_DESC,
      tip: ACTIVE_TIP,
      tipId: "io-field-active-tip",
      showTips: o.showTips,
    });
    closers.push(active.closeTip);
    const mode = selectInput(active.control, "io-select", {
      options: ACTIVE_OPTIONS,
      value: row.active,
      label: "Active, for " + row.strictName,
    });
    mode.disabled = !o.enabled;
    mode.addEventListener("change", (() => {
      if (!o.enabled) return;
      o.model.setActive(row.key, mode.value);
      o.redraw();
    }) as never);
  }

  const behavior = itemRow(detail, {
    name: BEHAVIOR_NAME,
    desc: BEHAVIOR_DESC,
    tip: BEHAVIOR_TIP,
    tipId: "io-field-behavior-tip",
    showTips: o.showTips,
  });
  closers.push(behavior.closeTip);
  const mode = selectInput(behavior.control, "io-select", {
    options: BEHAVIOR_OPTIONS,
    value: row.freeRoam,
    label: "Behavior for " + row.strictName,
  });
  mode.disabled = !o.enabled;
  mode.addEventListener("change", (() => {
    if (!o.enabled) return;
    o.model.setFreeRoam(row.key, mode.value);
    o.redraw();
  }) as never);

  /*
   * Видимость дочернего Field. Контрол был в старой доске кнопкой со значком
   * (`aria-label` = `toggle sub <key>`), в первую версию этой колонки не
   * попал и вернулся по замечанию заказчика 2026-08-27. Сверка карт записей
   * потери не поймала: `toggleSub` пишет в те же ветки конфига, что и соседние
   * контролы, — карта сравнивала ветки, а не контролы. Дыру закрывает сверка
   * набора причин записи в `fields_editor_write_map_tests.ts`.
   */
  if (row.subKey) {
    /*
     * Состояние читается у модели, а не из списка Fields. Дефект, купленный
     * этим: настоящий `normalizePkmOrder` выбрасывает ключи `_sub` из `left` и
     * `right`, поэтому строки дочернего Field в списке нет, и чтение оттуда
     * всегда давало «нет данных» — переключатель показывал `Yes`, что бы
     * человек ни выбрал (замечание заказчика 2026-08-27).
     */
    const on = o.model.getSubActive(row.subKey) !== "no";
    const child = itemRow(detail, {
      name: CHILD_NAME,
      desc: CHILD_DESC,
      tip: CHILD_TIP,
      tipId: "io-field-child-tip",
      showTips: o.showTips,
    });
    closers.push(child.closeTip);
    const pick = selectInput(child.control, "io-select", {
      options: CHILD_OPTIONS,
      value: on ? "yes" : "no",
      label: "Child Field of " + row.strictName,
    });
    pick.disabled = !o.enabled;
    pick.addEventListener("change", (() => {
      if (!o.enabled) return;
      /* `toggleSub` переключает, а не выставляет: зовём его только когда
         выбранное и правда отличается от нынешнего. */
      if ((pick.value !== "no") === on) return;
      o.model.toggleSub(row.subKey);
      o.redraw();
    }) as never);
  }

  /*
   * Свойство заметки принадлежит Field, а не отдельной таблице где-то ещё:
   * оно задаётся здесь, рядом со всем остальным, что Field решает (решение
   * заказчика 2026-08-27).
   *
   * Сейчас это только имя свойства. Тип (одно значение или список) и правило
   * значения (сырое или очищенное) живут в блоке `Note properties` на вкладке
   * Transform (10.9) и приезжают вместе с ним: решение заказчика 2026-08-27 —
   * настройка остаётся у Field, доработка идёт вместе с Transform.
   */
  const propertyHead = el(detail, "div", "io-sub io-item__namerow");
  el(propertyHead, "span", undefined, PROPERTY_HEAD);
  closers.push(tipBelow({
    head: propertyHead,
    host: el(detail, "div", "io-tipslot"),
    text: PROPERTY_HEAD_TIP,
    label: PROPERTY_HEAD,
    id: "io-field-property-tip",
    showTips: o.showTips,
  }));
  const property = itemRow(detail, {
    name: PROPERTY_NAME,
    desc: PROPERTY_DESC,
    showTips: o.showTips,
  });
  /* Поле шириной с выпадающий список `Prefix behavior` над ним: два контрола
     в одном столбце, и разная ширина читалась как разный вид настройки
     (замечание заказчика 2026-08-27). */
  const propertyInput = textInput(property.control, "io-text io-text--mono io-text--prop", {
    value: row.property,
    placeholder: "select Property",
    label: "YAML property for " + row.strictName,
  });
  propertyInput.disabled = !o.enabled;
  propertyInput.addEventListener("change", (() => {
    if (!o.enabled) return;
    o.model.setProperty(row.key, propertyInput.value);
  }) as never);

  /* У `element` значений нет: у него маркер, формат и способ шага (Ф6). */
  if (row.kind === "element") closers.push(renderElementRows(detail, row, o));
  else closers.push(renderValuesTable(detail, row, o));

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

/** Значение без решётки: её ставит отрисовка пузыря. */
function plain(token: string): string {
  return String(token || "").trim().replace(/^#/, "").replace(/^\[\[|\]\]$/g, "");
}

/**
 * Колонка `Preview`: Value так, как он встанет в строку, плюс тихий значок,
 * если его не прочесть (Н15–Н18). Пузырь рисуется тем же кодом, что и живые
 * предпросмотры, — иначе редактор и предпросмотр однажды разойдутся (П9).
 */
function previewCell(host: El, o: FieldsViewOpts, v: {
  token: string;
  fill: string;
  text: string;
  shown: ValueVisibility;
  custom: string;
}): void {
  const cell = el(host, "div", "io-vals__prev");
  applyTagVars(cell, o.ctx);
  bubble(cell, {
    token: plain(v.token),
    fill: v.fill,
    text: v.text,
    shown: v.shown === "default" ? "value" : v.shown,
    custom: v.custom,
    depth: 0,
  });
  /* У пустого Value текста нет, читать нечего (Н18). */
  if (v.shown === "empty") return;
  const ratio = contrastRatio(v.fill, v.text);
  if (ratio >= CONTRAST_FLOOR) return;
  const warn = el(cell, "span", "io-warn", "\u26A0");
  /* Одна подсказка на узел, один и тот же текст в обоих атрибутах. */
  const note = contrastWarning(ratio);
  warn.setAttribute("aria-label", note);
  warn.title = note;
}

/**
 * Таблица Values: девять колонок в порядке Ф7 — ручка, `Level`, `Value`,
 * `Prefix`, `Show`, `Fill`, `Text`, `Preview`, удаление. У Field типа `link`
 * колонок цвета нет: у ссылки нет своего цвета, остаются `Value` и `Prefix`.
 */
export function renderValuesTable(host: El, row: FieldRow, o: FieldsViewOpts): () => void {
  const ve: ValuesEditor = o.model.valuesEditor(row.key);
  const isLink = ve.kind === "wikilink";
  const closers: Array<() => void> = [];

  const head = el(host, "div", "io-sub io-item__namerow");
  el(head, "span", undefined, "Values");
  closers.push(tipBelow({
    head,
    host: el(host, "div", "io-tipslot"),
    text: VALUES_TIP,
    label: "Values",
    id: "io-values-tip",
    showTips: o.showTips,
  }));

  const box = el(host, "div", "io-vals" + (isLink ? " io-vals--link" : ""));
  const scroll = el(box, "div", "io-scroll");
  const inner = el(scroll, "div", "io-vals__inner" + (isLink ? " io-vals__inner--link" : ""));

  const headRow = el(inner, "div", "io-vals__head");
  /*
   * Место под подсказки колонок стоит сразу за шапкой и до первой строки:
   * подсказка раскрывается под шапкой во всю ширину таблицы. Слот пуст,
   * пока ни одной подсказки не открыто, и места тогда не занимает.
   */
  const colTips = el(inner, "div", "io-vals__tipslot");
  /*
   * У ссылки колонки те же, что у тега, за вычетом цвета: `Level` среди них
   * есть. Уровень у ссылки открывали 2026-08-27, в тот же день убирали —
   * стрелка уносила значение, — и в тот же день вернули, починив запись, а не
   * стрелку: ветка `wikilink` в `saveTree` теперь пишет и дочерние значения.
   */
  const columns = isLink
    ? ["", "Level", "Value", "Prefix", ""]
    : ["", "Level", "Value", "Prefix", "Show", "Fill", "Text", "Preview", ""];
  const tips = columnTips(isLink);
  for (const title of columns) {
    const cell = el(headRow, "div", "io-vals__col");
    el(cell, "span", "io-vals__coltext", title);
    const tip = tips[title];
    if (!tip) continue;
    closers.push(tipBelow({
      head: cell,
      host: colTips,
      text: tip,
      label: title,
      id: "io-values-col-" + title.toLowerCase() + "-tip",
      showTips: o.showTips,
    }));
  }

  const rows = flatten(ve.tree);
  if (!rows.length) {
    /* Пустая таблица говорит, что нажать (ПЗ2, ПЗ3). */
    el(box, "div", "io-side__empty", "no Values yet — add the first one below");
  }

  /* Что тянут: адрес строки переживает перерисовку, узел — нет. */
  let dragged: ValueAt | null = null;

  rows.forEach(({ row: v, at }) => {
    const line = el(inner, "div", "io-vals__row" + (at.level ? " io-vals__row--child" : ""));

    const grip = el(line, "div", "io-grip", "\u283F");
    grip.setAttribute("role", "button");
    grip.setAttribute("aria-label", "Drag " + v.token + " to reorder it");
    grip.title = "Drag " + v.token + " to reorder it";
    grip.draggable = o.enabled;
    grip.addEventListener("dragstart", ((ev: DragEv) => {
      dragged = at;
      line.classList.add("io-dragging");
      try { ev.dataTransfer?.setData("text/plain", at.token); } catch { /* десктоп всегда даёт dataTransfer */ }
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

    /*
     * Ф8: одна кнопка со стрелкой. Вниз — Value уходит дочерним к тому, что
     * стоит над ним; вверх — возвращается на верхний уровень. У первого
     * значения списка родителя нет, и кнопка выключена. Колонка есть у обоих
     * типов со значениями — и у тега, и у ссылки.
     */
    {
      const depth = el(line, "div", "io-depthcell");
      const child = at.level === 1;
      const arrow = btn(depth, "io-icon", {
        text: child ? "\u2190" : "\u2192",
        label: child
          ? "Make " + v.token + " a top-level Value"
          : "Make " + v.token + " a child Value",
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
    token.addEventListener("change", (() => {
      if (!o.enabled) return;
      ve.saveTree(ve.editRow(ve.tree, at, { token: token.value }),
        "pkm:behavior:order:deep:rename:" + row.key);
      o.redraw();
    }) as never);

    /*
     * Колонки `Parent` здесь больше нет. Она появилась 2026-08-27, когда
     * расширенная карта показала потерянный контрол привязки значения ссылки
     * к значению другого Field, — и в тот же день убрана: заказчик её
     * отклонил, а проверка показала, что движок эту привязку не читает вовсе
     * (`__ioParentBinding` не встречается ни в `main.js`, ни в `pkm_v2`, ни в
     * `src/core`). Разбор — в PRD, фаза 3b.
     */

    /*
     * Колонка `Prefix` — это чекбокс перед строкой: пусто значит обычный
     * маркер списка. Пишется той же записью, что и в старой доске.
     */
    const prefix = textInput(line, "io-text io-text--mono", {
      value: String(v.prefixMode === "checkbox" ? v.checkboxToken || "" : ""),
      placeholder: "no",
      label: "Prefix for " + v.token,
    });
    prefix.disabled = !o.enabled;
    prefix.addEventListener("change", (() => {
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
        o.notice("InlineOverhaul: checkbox token must be like [ ] or [I]");
        prefix.value = String(v.checkboxToken || "");
        return;
      }
      ve.saveTree(ve.editRow(ve.tree, at, { prefixMode: "checkbox", checkboxToken: cb }),
        "pkm:behavior:order:deep:checkbox:" + row.key);
      o.redraw();
    }) as never);

    if (!isLink) {
      /*
       * Цвет читается и пишется по одному и тому же ключу — по Field, а не по
       * уровню значения. Дочернее значение хранит цвет там же, где родитель:
       * так это лежит в конфиге, и так его читает рантайм. Развести чтение и
       * запись однажды уже вышло: цвет дочернего значения писался в Field, а
       * читался из дочернего Field, и потому не появлялся никогда.
       */
      const fieldId = ve.parentFieldId || row.strictName;
      const visual = o.model.getValueVisual(fieldId, v.token);

      const shownCell = el(line, "div", "io-showncell");
      const shown = selectInput(shownCell, "io-select", {
        options: SHOWN_OPTIONS,
        value: visual.visibility,
        label: "Show, for " + v.token,
      });
      shown.disabled = !o.enabled;
      shown.addEventListener("change", (() => {
        if (!o.enabled) return;
        o.model.setValueVisual(fieldId, v.token, { visibility: shown.value as ValueVisibility },
          "pkm:visuals:tag:visibility:" + fieldId);
        o.redraw();
      }) as never);
      if (visual.visibility === "custom") {
        const custom = textInput(shownCell, "io-text io-text--mono", {
          value: visual.customText,
          placeholder: "printed instead",
          label: "Custom text for " + v.token,
        });
        custom.disabled = !o.enabled;
        custom.addEventListener("change", (() => {
          if (!o.enabled) return;
          o.model.setValueVisual(fieldId, v.token, { customText: custom.value },
            "pkm:visuals:tag:custom-text:" + fieldId);
        }) as never);
      }

      const color = (key: "fillColor" | "textColor", label: string, reason: string): void => {
        const wrap = el(line, "div");
        const input = wrap.createEl("input", {
          cls: "io-colin",
          type: "color",
          value: (key === "fillColor" ? visual.fillColor : visual.textColor) || "#ffffff",
          attr: { "aria-label": label + " for " + v.token },
        }) as ElInput;
        input.disabled = !o.enabled;
        input.addEventListener("change", (() => {
          if (!o.enabled) return;
          o.model.setValueVisual(fieldId, v.token, { [key]: input.value }, reason + ":" + fieldId);
          o.redraw();
        }) as never);
      };
      color("fillColor", "Fill color", "pkm:visuals:tag:fill");
      color("textColor", "Text color", "pkm:visuals:tag:text");

      previewCell(line, o, {
        token: v.token,
        fill: visual.fillColor,
        text: visual.textColor,
        shown: visual.visibility,
        custom: visual.customText,
      });
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
      if (visual.fillColor || visual.textColor) {
        const back = btn(tools, "io-icon", {
          text: "\u21ba",
          label: "Reset the colors of " + v.token + " back to the colors of the theme",
        });
        back.disabled = !o.enabled;
        back.addEventListener("click", (() => {
          if (!o.enabled) return;
          o.model.setValueVisual(fieldId, v.token, { fillColor: "", textColor: "" },
            "pkm:visuals:tag:color-reset:" + fieldId);
          o.redraw();
        }) as never);
      }
    }
    /* Удаление красное: единственная кнопка строки, которая уносит данные
       (замечание заказчика 2026-08-27). */
    const del = btn(tools, "io-icon io-icon--danger", { text: "\u2715", label: "Remove " + v.token });
    del.disabled = !o.enabled;
    del.addEventListener("click", (() => {
      if (!o.enabled) return;
      ve.saveTree(ve.removeRow(ve.tree, at), "pkm:behavior:order:deep:delete-token:" + row.key);
      o.redraw();
    }) as never);
  });

  const foot = el(box, "div", "io-vals__foot");
  /* Решётка и двойные скобки не обязательны: значение читается одинаково с
     ними и без них (замечание заказчика 2026-08-27). */
  const add = textInput(foot, "io-text io-text--mono", {
    value: "",
    placeholder: isLink ? "[[wikilink]] / wikilink" : "#tag / tag",
    label: "New Value for " + row.strictName,
  });
  add.disabled = !o.enabled;
  /* Акцентная, как и `Add Field`: заказчик просил, чтобы её было видно. */
  const addBtn = btn(foot, "io-btn io-btn--sm io-btn--cta",
    { text: "Add Value", label: "Add a Value to " + row.strictName });
  addBtn.disabled = !o.enabled;
  addBtn.addEventListener("click", (() => {
    if (!o.enabled) return;
    const res = ve.addToken(add.value);
    if (res.error) {
      o.notice(res.error);
      return;
    }
    if (!res.ok) return;
    o.redraw();
  }) as never);
  /* \u0421\u0442\u0440\u043e\u043a\u0430 \u00abUse \u2192 to make a Value a child\u2026\u00bb \u0438\u0437 \u043f\u043e\u0434\u0432\u0430\u043b\u0430 \u0443\u0431\u0440\u0430\u043d\u0430: \u043e\u043d\u0430 \u0443\u0435\u0445\u0430\u043b\u0430 \u0432
     \u043f\u043e\u0434\u0441\u043a\u0430\u0437\u043a\u0443 \u043a\u043e\u043b\u043e\u043d\u043a\u0438 `Level`, \u0433\u0434\u0435 \u0435\u0451 \u0438\u0449\u0443\u0442 (\u0437\u0430\u043c\u0435\u0447\u0430\u043d\u0438\u0435 \u0437\u0430\u043a\u0430\u0437\u0447\u0438\u043a\u0430 2026-08-27). */

  return () => { closers.forEach(fn => fn()); };
}

/* ---- Field типа element (Ф6) -------------------------------------------- */

/**
 * Как `next` и `previous` двигают значение элемента. Значения конфига прежние
 * (З1) — подписи переписаны по замечанию заказчика 2026-08-27: прежние
 * («A fixed amount», «A command such as now», «A list you define») читались
 * как ответ на другой вопрос.
 */
const STEP_OPTIONS = [
  { value: "increment", label: "Fixed step" },
  { value: "command", label: "Command" },
  { value: "custom", label: "Custom step" },
] as const;

/*
 * Тексты строк Field типа Emoji. Переписаны 2026-08-27 по замечанию заказчика:
 * прежние описания и подсказки не отвечали на вопрос «что тут вводить», а
 * `Value format` без примеров не отвечал вовсе.
 *
 * Про формат сказана правда о рантайме, а не о моих ожиданиях: маска знает
 * ровно `YYYY MM DD HH mm ss` (`src/core/shared_utils.js`, `normalizeFormatMask`
 * и `hasFormatTokens`), одни цифры дают счётчик той ширины, сколько цифр
 * написано (`parseNumericLiteralSpec`), цифры с разделителями — счётчик с
 * разделителями (`parseNumericPatternSpec`). Всё остальное шагать не умеет.
 */
const MARKER_NAME = "Emoji-prefix";
const MARKER_DESC = "The character that stands in front of the Value in the line";
const MARKER_TIP =
  "This is how the Field is recognised: the plugin reads <code>📅 2026-08-27</code> as "
  + "this Field only because <code>📅</code> stands in front. Give it a character no "
  + "other Field uses, or the two will be taken for one";
const FORMAT_NAME = "Value format";
const FORMAT_DESC = "The shape of the Value: a date, a time or a number";
const FORMAT_PLACEHOLDER = "YYYY-MM-DD / HHmm / 1";
const FORMAT_TIP =
  "Spell out the shape you want to see in the line. A date or a time is built from "
  + "<code>YYYY</code> (year), <code>MM</code> (month), <code>DD</code> (day), <code>HH</code> "
  + "(hour), <code>mm</code> (minute), <code>ss</code> (second), with any separators between them: "
  + "<code>YYYY-MM-DD</code> writes <code>2026-08-27</code>, <code>DD.MM</code> writes "
  + "<code>27.08</code>, <code>HHmm</code> writes <code>1435</code>. Digits alone make a counter, "
  + "and the number of digits is the width it keeps: <code>1</code> counts <code>1</code>, "
  + "<code>2</code>, <code>3</code>, while <code>001</code> counts <code>001</code>, "
  + "<code>002</code>. Anything else is taken as plain text and never steps";
const STEP_DESC =
  "What should happen with the Value when you use <code>next</code> or <code>previous</code> command";
const STEP_TIP =
  "<b>Fixed step</b> adds the same amount on every press: a day to a date, one to a counter. "
  + "<b>Command</b> throws the old Value away and writes a fresh one — the time of the press, "
  + "or a random string for an id. <b>Custom step</b> walks a list of steps you write yourself, "
  + "and can end the cycle by removing the Value from the line";
const AMOUNT_DESC = "How much one press adds to the Value";
const AMOUNT_TIP =
  "<code>next</code> adds this much, <code>previous</code> takes the same back. What one unit "
  + "means comes from <code>Value format</code>: with <code>YYYY-MM-DD</code> it is a day, with "
  + "<code>HHmm</code> a minute, with a counter just one";
const COMMAND_DESC = "What the press writes into the Value instead of stepping it";
const COMMAND_TIP =
  "<code>The current date and time</code> writes the moment of the press in the shape set by "
  + "<code>Value format</code>. The random ones fill the Value with numbers or letters, which is "
  + "what an id needs";
const STEPS_DESC = "One step per line, in the order the presses walk them";
const STEPS_TIP =
  "A line is a number, and a number in brackets after it says how many presses stay on that step: "
  + "<code>1 (3)</code> moves by one for three presses. <code>END</code> ends the cycle and "
  + "removes the Value";

/**
 * Строки Field типа `element`: маркер, формат и то, чем он шагает. Значений у
 * такого Field нет — у него одно значение, которое команда умеет двигать.
 *
 * Строки стоят под своим заголовком, а не в общей куче под `Placement`:
 * заказчик читал их как настройки размещения (замечание 2026-08-27).
 */
export function renderElementRows(host: El, row: FieldRow, o: FieldsViewOpts): () => void {
  const ed = o.model.elementEditor(row.key);
  const closers: Array<() => void> = [];

  el(host, "div", "io-sub", "Value");

  /** Строка с полем ввода. */
  const line = (name: string, desc: string, tip: string, tipId: string, value: string,
    placeholder: string, save: (v: string) => void): void => {
    const item = itemRow(host, { name, desc, tip, tipId, showTips: o.showTips });
    closers.push(item.closeTip);
    const input = textInput(item.control, "io-text io-text--mono", {
      value,
      placeholder,
      label: name + " for " + row.strictName,
    });
    input.disabled = !o.enabled;
    input.addEventListener("change", (() => {
      if (!o.enabled) return;
      save(input.value);
      o.redraw();
    }) as never);
  };

  line(MARKER_NAME, MARKER_DESC, MARKER_TIP, "io-element-marker-tip", ed.emoji,
    "one character or emoji", v => ed.setEmoji(v));
  line(FORMAT_NAME, FORMAT_DESC, FORMAT_TIP, "io-element-format-tip", ed.format,
    FORMAT_PLACEHOLDER, v => ed.setFormat(v));

  const steps = itemRow(host, {
    name: "Steps by",
    desc: STEP_DESC,
    tip: STEP_TIP,
    tipId: "io-element-step-tip",
    showTips: o.showTips,
  });
  closers.push(steps.closeTip);
  const mode = selectInput(steps.control, "io-select", {
    options: STEP_OPTIONS,
    value: ed.mode,
    label: "Steps by, for " + row.strictName,
  });
  mode.disabled = !o.enabled;
  mode.addEventListener("change", (() => {
    if (!o.enabled) return;
    ed.setMode(mode.value);
    o.redraw();
  }) as never);

  /* Показывается только то, чем этот режим шагает: три поля разом сбивают с толку. */
  if (ed.mode === "increment") {
    const by = itemRow(host, {
      name: "Amount",
      desc: AMOUNT_DESC,
      tip: AMOUNT_TIP,
      tipId: "io-element-amount-tip",
      showTips: o.showTips,
    });
    closers.push(by.closeTip);
    const input = textInput(by.control, "io-text io-text--mono", {
      value: String(ed.incrementBy),
      label: "Amount for " + row.strictName,
    });
    input.disabled = !o.enabled;
    input.addEventListener("change", (() => {
      if (!o.enabled) return;
      ed.setIncrementBy(Number(input.value || 1));
    }) as never);
  } else if (ed.mode === "command") {
    const cmd = itemRow(host, {
      name: "Command",
      desc: COMMAND_DESC,
      tip: COMMAND_TIP,
      tipId: "io-element-command-tip",
      showTips: o.showTips,
    });
    closers.push(cmd.closeTip);
    const pick = selectInput(cmd.control, "io-select", {
      options: [
        { value: "now", label: "The current date and time" },
        { value: "randomN", label: "Random numbers" },
        { value: "randomE", label: "Random characters" },
      ],
      value: ed.command,
      label: "Command for " + row.strictName,
    });
    pick.disabled = !o.enabled;
    pick.addEventListener("change", (() => {
      if (!o.enabled) return;
      ed.setCommand(pick.value);
    }) as never);
  } else {
    const own = itemRow(host, {
      name: "Steps",
      desc: STEPS_DESC,
      tip: STEPS_TIP,
      tipId: "io-element-steps-tip",
      showTips: o.showTips,
    });
    closers.push(own.closeTip);
    const area = own.control.createEl("textarea", {
      cls: "io-textarea",
      attr: { "aria-label": "Steps for " + row.strictName, rows: "3" },
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
 * Редактор целиком. Таблица Values и строки `element` приезжают следующим
 * куском; до тех пор блок к панели не подключён, и полуготовый редактор
 * человек не видит: редактор без таблицы Values — это потеря доступа к
 * настройкам, а не промежуточное состояние.
 */
export function renderFieldsEditor(host: El, o: FieldsViewOpts): () => void {
  const wrap = el(host, "div", "io-fields");
  const closers: Array<() => void> = [];

  const listCol = el(wrap, "div", "io-fields__col");
  const listHead = el(listCol, "div", "io-fields__colhead");
  el(listHead, "span", undefined, "Fields");
  closers.push(tipBelow({
    head: listHead,
    host: el(listCol, "div", "io-tipslot"),
    text: LIST_TIP,
    label: "the Fields list",
    id: "io-fields-list-tip",
    showTips: o.showTips,
  }));

  const list = el(listCol, "div", "io-fields__list");
  renderFieldList(list, o);

  const rows = o.model.listFields();
  const key = selectedKey(rows, o.state);
  const row = rows.find(r => r.key === key) || null;

  const detailCol = el(wrap, "div", "io-fields__col");
  const detailHead = el(detailCol, "div", "io-fields__colhead");
  /* У Field типа `element` значений нет: у него один маркер и один формат.
     Колонка названа так же, как чип типа, — одним словом. */
  el(detailHead, "span", undefined, row && row.kind === "element" ? TYPE_LABEL.element : "Values");
  const detail = el(detailCol, "div", "io-fields__detail");
  /* Ни одного Field — не ошибка, а приглашение (ПЗ2, ПЗ3). */
  if (row) closers.push(renderFieldDetail(detail, row, o));
  else el(detail, "div", "io-fields__hint", "add a Field on the left to set it up here");

  return () => {
    closers.forEach(fn => fn());
    wrap.remove();
  };
}
