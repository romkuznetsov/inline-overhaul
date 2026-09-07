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
import { el, btn, cssVar, cssVarValue, rich, selectInput, textInput, tipBelow } from "./dom.ts";
import type { FieldsModel, FieldRow, ValueAt, ValuesEditor, ValueTreeRow } from "./fields_model.ts";
import type { FieldKind, SettingsCtx, ValueVisibility } from "../types.ts";
import { CONTRAST_FLOOR, contrastRatio, contrastWarning, toHexColor } from "./contrast.ts";
import { applyTagVars, bubble, bubbleLabel } from "./previews.ts";
import { sayIn } from "../texts_blocks.ts";
import { TYPE_COLOR, typeColor } from "./preview_data.ts";
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
 * Подпись типа. В конфиге тип ссылки называется `wikilink`, а тип элемента —
 * `element`, и такими остаются (З1): меняются только видимые подписи.
 *
 * `Emoji` вместо `Element` — по замечанию заказчика 2026-08-27: чип шириной в
 * слово `Element` вместе со стрелками съедал имя Field в узкой левой колонке,
 * и «444» показывалось как «4...».
 */
export const TYPE_LABEL: Record<FieldKind, string> = {
  tag: "Tag",
  wikilink: "Link",
  element: "Emoji",
};

/**
 * Цвет чипа типа (Ф4). Карта живёт в `preview_data.ts` — она же красит чипы
 * Fields в предпросмотрах, и второе объявление разошлось бы с первым (У-32).
 */
export { TYPE_COLOR };

const SIDE_LABEL = { left: "Left Block", right: "Right Block" } as const;


/** Пустая сторона — приглашение, а не ошибка (ПЗ2, ПЗ3). */

/*
 * Короткое имя Field. Своя строка, а не кусок шапки, и называется тем, что
 * значит: `short name` не говорило, где это имя видно (замечание заказчика,
 * шестой круг). В конфиге настройка по-прежнему `order.labels` (З1).
 */

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
/** 1.4.1.2.5: заголовок `Behavior` был единственным разделом без «?». */

/** У Field типа element значение одно, и раздел называется в единственном. */

/**
 * 1.4.1.2.1: шапка правой колонки. Левая («Fields») объясняла себя, правая —
 * нет, и заметил это заказчик, а не проверка.
 */


/** Ф9: как Value показывается в строке. Значения конфига прежние (З1). */
const SHOWN_OPTIONS = [
  { value: "default", label: "default" },
  { value: "empty", label: "empty" },
  { value: "custom", label: "custom" },
] as const;


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
const CHILD_OPTIONS = [
  { value: "yes", label: "Yes" },
  { value: "no", label: "No" },
] as const;

/**
 * Предусловие Field (10.13.4). Три строки: есть ли предусловие, какой Field
 * ждём и какое его значение. Две последние появляются только при `Yes` —
 * решение заказчика 2026-08-27.
 *
 * Пишется двумя ключами, которые рантайм понимает давно: `dependsOn` и
 * `enabledForParentValues`. Что из этого следует для человека и почему список
 * Fields в нём короче, чем весь список, — в подсказках ниже и в 10.13.
 */
const PREREQ_OPTIONS = [
  { value: "no", label: "No" },
  { value: "yes", label: "Yes" },
] as const;

/** Пока Field не выбран, писать нечего: пустое значение ничего не пишет. */


/**
 * Свойства заметки — свой раздел, а не строка внутри `Behavior` (замечание
 * заказчика 2026-08-27): сюда приедут остальные настройки свойства, когда
 * дойдёт черёд блока `Note properties` на вкладке Transform. Подсказка стоит у
 * заголовка раздела и объясняет, зачем он нужен вообще; у строки внутри
 * остаётся только описание, чтобы два «?» не стояли рядом.
 */
/*
 * Подсказка у строки, 2026-09-01 (замечание 1.3.2.1). Заказчик 2026-08-27
 * решил обратное — «?» здесь не ставить, потому что подсказка раздела стоит
 * прямо над ней, — и теперь попросил её вернуть. Последнее слово за ним;
 * прежнее решение записано, чтобы третий круг не начался с нуля.
 */
/* Подсказка в пустом поле: замечание заказчика 2026-08-27, третий круг. */
/*
 * Полный набор настроек свойства (10.9). Приехал сюда решением заказчика
 * 2026-08-28: прототип держал их таблицей в блоке `Note properties` на вкладке
 * Transform, а место им — там, где настраивается сам Field. Блок удалён,
 * тексты сняты с него.
 */

/* Имя задано заказчиком 2026-08-28. Шесть слов — больше пяти, которые
   разрешает линтер текстов Г10; исключение записано в PRD 10.9, чтобы
   фаза 4 не переименовала обратно. */

/* Видимая строка, поэтому без точки в конце (Р10). */

/* Текст задан заказчиком 2026-08-28. */

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

/**
 * Как вёрстка спрашивает свой текст (10.13.47): `const say = words(o)`.
 *
 * Английское живёт в `texts_blocks.ts`, а не здесь: у видимого текста один
 * дом, и второе его объявление разошлось бы молча (У-32). Имена строк
 * оставлены теми же, какими назывались константы, — так видно, что переезд
 * не переписал ни слова.
 */
type Say = (name: string, ...args: readonly (string | number)[]) => string;

const words = (o: { ctx: SettingsCtx }): Say => sayIn("field-editor", o.ctx);

/* ---- то, с чем работает вёрстка --------------------------------------- */

/** Состояние вида. В конфиг не попадает (О0). */
export interface FieldsViewState {
  /** Ключ выбранного Field. Пустая строка — выбран первый по порядку. */
  selected: string;
  /**
   * У каких Fields строка `Prerequisite Field` стоит на `Yes`, пока сам Field
   * ещё не выбран. Это состояние вида, а не настройка: в конфиг предусловие
   * попадает только вместе с Field, которого ждём, — иначе там остался бы
   * `Yes`, не значащий ничего. Ключ Field → человек ответил `Yes`.
   */
  prereqOpen?: Record<string, boolean>;
}

/** Ответ окна `Add Field`. */
export interface NewField {
  /** Системное имя: им Field назван в конфиге и в именах его команд. */
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
  /** Тумблер `Show setting ids in tips`: подпись id в конце подсказки (A3, C52). */
  showIds?: boolean;
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
  /**
   * Окно переименования Field. Спрашивает новое имя и называет цену:
   * в заметках останется старый тег, а хоткей отвяжется (1.4.1.2.2).
   */
  askRename?: (name: string, done: (next: string | null) => void) => void;
}

/* ---- левая колонка: список Fields -------------------------------------- */

/**
 * Список Fields двумя сторонами (Ф1). Сторона строки и есть Block, в который
 * Field пишется: отдельной настройки «сторона» нет и быть не должно.
 */
export function renderFieldList(list: El, o: FieldsViewOpts): void {
  const say = words(o);
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
      el(sec, "div", "io-side__empty", say("EMPTY_SIDE"));
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
      /* Одна подсказка на узел — и один атрибут: `title` рядом с `aria-label`
         даёт вторую всплывающую коробку поверх первой (пятый круг). */
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
        o.model.moveKey(row.side, dragged, before);
        o.redraw();
      }) as never);

      const pick = btn(item, "io-fields__pick", { label: say("SHOW_FIELD", row.label) });
      el(pick, "span", "io-fields__name", row.label);
      cssVar(
        el(pick, "span", "io-chip io-chip--typed", TYPE_LABEL[row.kind]),
        "--io-chip-bg",
        typeColor(row.kind),
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
      arrow("↑", -1, say("MOVE_FIELD_UP", row.label));
      arrow("↓", 1, say("MOVE_FIELD_DOWN", row.label));
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
        o.notice(res.error || "The Field was not added");
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
  showIds?: boolean;
}): { control: El; info: El; closeTip: () => void } {
  const row = el(host, "div", "io-item");
  const info = el(row, "div", "io-item__info");
  const nameRow = el(info, "div", "io-item__namerow");
  el(nameRow, "div", "io-item__name", o.name);
  const closeTip = o.tip && o.tipId
    ? tipBelow({ head: nameRow, host: info, text: o.tip, label: o.name, id: o.tipId, showTips: o.showTips, showIds: o.showIds })
    : () => {};
  rich(el(info, "div", "io-item__desc"), o.desc);
  /* `info` отдаётся наружу: под описанием иногда встаёт предупреждение — оно
     принадлежит строке, а не колонке контролов (B21). */
  return { control: el(row, "div", "io-item__control"), info, closeTip };
}

/**
 * Предусловие Field: три строки в разделе `Behavior` (10.13.4).
 *
 * Первая спрашивает, есть ли предусловие вообще; при `Yes` появляются ещё
 * две — какой Field ждём и какое его значение. Значение необязательно: без
 * него годится любое.
 *
 * Строки нет вовсе, если ждать некого: в списке кандидатов только Fields из
 * того же списка определений (`leftMode` для тегов, `rightMode` для ссылок и
 * элементов) и без петель — их считает модель. Контрол, который никуда не
 * ведёт, не показывается (З8).
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
    options: PREREQ_OPTIONS,
    value: opened ? "yes" : "no",
    label: say("PREREQ_NAME") + " for " + row.strictName,
  });
  onPick.disabled = !o.enabled;
  onPick.addEventListener("change", (() => {
    if (!o.enabled) return;
    const yes = onPick.value === "yes";
    (o.state.prereqOpen as Record<string, boolean>)[row.key] = yes;
    /* `No` снимает предусловие из конфига; `Yes` пока ничего не пишет —
       писать нечего, Field ещё не выбран. */
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

/**
 * Выбранный Field: как он называется, что он такое, как встаёт в строку и как
 * его убрать (Ф6). Таблица Values и строки `element` приезжают следующим
 * куском — они живут ниже по этой же колонке.
 */
export function renderFieldDetail(detail: El, row: FieldRow, o: FieldsViewOpts): () => void {
  const say = words(o);
  const closers: Array<() => void> = [];

  /*
   * Шапка несёт только то, чем Field является: системное имя, тип и удаление.
   * Системное имя — заголовок, а не поле: оно задаётся один раз в окне
   * `Add Field` и дальше не меняется (решение заказчика 2026-08-27, пересмотр
   * того же дня). Причина: имя стоит в именах команд и в служебном файле,
   * по которому движок читает Fields.
   *
   * Короткое имя стояло здесь же и уехало своей строкой ниже: в шапке оно
   * оказалось зажато между чипом типа и красной корзиной (замечание
   * заказчика, шестой круг).
   */
  const title = el(detail, "div", "io-fields__title");
  el(title, "h4", undefined, row.strictName);
  cssVar(
    el(title, "span", "io-chip io-chip--typed", TYPE_LABEL[row.kind]),
    "--io-chip-bg",
    typeColor(row.kind),
  );
  /*
   * Карандаш — слева от корзины (замечание заказчика 1.4.1.2.2). Системное
   * имя задавалось один раз в окне `Add a Field` и дальше не менялось: оно
   * стоит в заметках и в идентификаторах команд. Заказчик решил 2026-08-31,
   * что менять его можно, но панель обязана назвать цену — это делает окно.
   *
   * Кнопки нет, когда окна нет: нажатие, которому некуда вести, хуже его
   * отсутствия (З8).
   */
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

  /*
   * Удаление — белая корзина на красном, без слова (замечание заказчика
   * 2026-08-27): оно должно бросаться в глаза, а не притворяться обычной
   * кнопкой. Значок лежит своим узлом и обесцвечивается в белый фильтром:
   * эмодзи приходит со своими цветами, и на красной заливке цветная корзина
   * читается грязным пятном. Смысл кнопки несут `aria-label` и `title`.
   */
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

  /*
   * Имя в TagWheel — своя строка сразу под шапкой (замечание заказчика,
   * шестой круг). В шапке оно стояло между чипом типа и красной корзиной и
   * читалось как случайный набор. Строка про то, как Field назван, а не про
   * то, как он себя ведёт, поэтому стоит до заголовка `Behavior`.
   */
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
   * Что Field пишет в строку — раньше того, как он себя ведёт. Заказчик
   * просил поднять `Values` под `Name in TagWheel` и над `Behavior`, и для
   * всех типов Field сразу (замечание 1.4.1.2.4); у `element` значение одно,
   * и на этом месте стоит его блок.
   */
  /* У `element` значений нет: у него маркер, формат и способ шага (Ф6). */
  if (row.kind === "element") closers.push(renderElementRows(detail, row, o));
  else closers.push(renderValuesTable(detail, row, o));

  /* Заголовок раздела — Behavior: под ним Active, Prefix behavior и
     Child Field (замечание заказчика 2026-08-27). «?» у него появился по
     замечанию 1.4.1.2.5: заголовок был единственным без объяснения. */
  const behaviorHead = el(detail, "div", "io-sub io-item__namerow");
  el(behaviorHead, "span", undefined, "Behavior");
  closers.push(tipBelow({
    head: behaviorHead,
    host: el(detail, "div", "io-tipslot"),
    text: say("BEHAVIOR_HEAD_TIP"),
    label: "Behavior",
    id: "io-field-behavior-tip",
    showTips: o.showTips, showIds: o.showIds,
  }));

  /*
   * Работает ли Field. У дочернего Field этого ряда нет намеренно: его
   * включает и выключает родитель рядом `Child Field` ниже, и делает это
   * `toggleSub` — двумя записями, а не одной. Две точки для одного и того же
   * — это две правды, и одна из них однажды окажется старой.
   */
  if (!row.parent) {
    const active = itemRow(detail, {
      name: say("ACTIVE_NAME"),
      desc: say("ACTIVE_DESC"),
      tip: say("ACTIVE_TIP"),
      tipId: "io-field-active-tip",
      showTips: o.showTips, showIds: o.showIds,
    });
    closers.push(active.closeTip);
    const mode = selectInput(active.control, "io-select", {
      options: ACTIVE_OPTIONS,
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

  const behavior = itemRow(detail, {
    name: say("BEHAVIOR_NAME"),
    desc: say("BEHAVIOR_DESC"),
    tip: say("BEHAVIOR_TIP"),
    tipId: "io-field-behavior-tip",
    showTips: o.showTips, showIds: o.showIds,
  });
  closers.push(behavior.closeTip);
  const mode = selectInput(behavior.control, "io-select", {
    options: BEHAVIOR_OPTIONS,
    value: row.freeRoam,
    label: say("BEHAVIOR_FOR", row.strictName),
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
      name: say("CHILD_NAME"),
      desc: say("CHILD_DESC"),
      tip: say("CHILD_TIP"),
      tipId: "io-field-child-tip",
      showTips: o.showTips, showIds: o.showIds,
    });
    closers.push(child.closeTip);
    const pick = selectInput(child.control, "io-select", {
      options: CHILD_OPTIONS,
      value: on ? "yes" : "no",
      label: say("CHILD_OF", row.strictName),
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
   * Предусловие Field (10.13.4). Стоит последним в разделе `Behavior`: это
   * самое сильное из того, что тут решается, — Field с предусловием молчит,
   * пока не выполнено условие, — и читать его надо после всего остального.
   *
   * Дочернему Field предусловия не бывает: его `dependsOn` уже занят
   * родителем, и вторым тем же ключом распорядиться нечем (З8).
   */
  if (!row.parent) closers.push(...prerequisiteRows(detail, row, o));

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
  el(propertyHead, "span", undefined, say("YAML_HEAD"));
  closers.push(tipBelow({
    head: propertyHead,
    host: el(detail, "div", "io-tipslot"),
    text: say("YAML_HEAD_TIP"),
    label: say("YAML_HEAD"),
    id: "io-field-property-tip",
    showTips: o.showTips, showIds: o.showIds,
  }));
  closers.push(yamlPropertyRows(detail, row, o));

  return () => { closers.forEach(fn => fn()); };
}

/**
 * Раздел `YAML property`: имя свойства, тип, правило значения и то, что будет
 * записано (10.9 Я1–Я4).
 *
 * Пример в последней строке считает движок, а не панель: `yamlExamples`
 * отдаёт ему выдуманную строку и возвращает то, что он запишет. Панель тут
 * ничего не вычисляет — иначе разошлась бы с движком на ближайшей правке (П9).
 *
 * Конфиг для этого берётся у платформы. Её нет в проверках вёрстки, и тогда
 * строки примера просто нет: показать вместо него догадку было бы хуже.
 */
function yamlPropertyRows(detail: El, row: FieldRow, o: FieldsViewOpts): () => void {
  const say = words(o);
  const closers: Array<() => void> = [];
  /*
   * Запись и перерисовка развязаны, и это не осторожность впрок.
   * `plugin.setConfigPatch` после самой записи делает многое: лог dev-режима,
   * пересборку правил, перерисовку TagWheel. Исключение оттуда прилетало
   * наружу — запись при этом уже прошла, а до `redraw` дело не доходило, и
   * экран оставался прежним до перехода по вкладкам (замечание заказчика
   * 2026-08-28: «в Preview ничего не меняется»). Теперь перерисовка идёт в
   * `finally`, а сбой записи виден в консоли, а не в интерфейсе (З8).
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
  /*
   * Имена свойств подсказываются из vault (Я4). Приватное API может не
   * ответить — тогда список пуст, и поле работает как обычное поле ввода.
   */
  const app = o.ctx.platform ? (o.ctx.platform.plugin as { app?: unknown }).app : null;
  const props = vaultProperties(app);
  /*
   * Ссылка в свойстве типа `tags` — предупреждение, а не запрет (решение
   * заказчика 2026-09-02).
   *
   * Он назначил Field типа ссылка на свойство `tags`, и в заметку попадало
   * `"[[test1]]"`; для типа `tags` Obsidian ссылок не принимает и ставит знак
   * несоответствия (B21). Запись остаётся его: плагин пишет то, что назначено,
   * и не решает за человека — только говорит, чем это кончится.
   */
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

  if (cfg) {
    /*
     * Превью стоит справа, в колонке контролов, и той же ширины, что поле
     * свойства над ним (замечание заказчика 2026-08-28): строка настройки
     * читается как остальные, а не как выпадающий из ряда абзац. Это не
     * контрол, а вывод, поэтому рамка и моноширинный шрифт, а длинная строка
     * переносится внутри рамки, а не уезжает за край.
     */
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
 * Цвета, которыми пузырь Value нарисован, когда своих у него нет. Те же, что
 * в `.io-bubble` (`styles.css`): заливка — акцент темы, текст — «текст на
 * цветной подложке». Заметка с 2026-08-28 рисует тем же (`TagVisualTokenWidget`).
 *
 * Пусто — прочитать тему нечем (заглушка DOM), и тогда контраст не считается.
 */
interface ThemePair {
  fill: string;
  text: string;
}

function themePair(node: El): ThemePair {
  return {
    fill: cssVarValue(node, "--interactive-accent"),
    text: cssVarValue(node, "--text-on-accent"),
  };
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
function previewCell(host: El, o: FieldsViewOpts, theme: ThemePair, v: {
  token: string;
  fill: string;
  text: string;
  shown: ValueVisibility;
  custom: string;
}): El {
  const cell = el(host, "div", "io-vals__prev");
  applyTagVars(cell, o.ctx);
  const drawn = bubble(cell, {
    token: plain(v.token),
    fill: v.fill,
    text: v.text,
    shown: v.shown === "default" ? "value" : v.shown,
    custom: v.custom,
    depth: 0,
  });
  /* У пустого Value текста нет, читать нечего (Н18). */
  if (v.shown === "empty") return drawn;
  /*
   * Сравниваются цвета, которыми Value НАРИСОВАН, а не только заданные руками.
   * До 2026-08-28 незаданный цвет текста означал «претензий нет», и значок
   * появлялся лишь у Value, где человек выставил оба цвета: белое на красном
   * (4.0:1) значок получало, а белое на жёлтом (1.7:1) — нет, хотя читается
   * хуже. Незаданный цвет — не отсутствие цвета, а цвет темы.
   */
  const ratio = contrastRatio(v.fill || theme.fill, v.text || theme.text);
  if (ratio >= CONTRAST_FLOOR) return drawn;
  const warn = el(cell, "span", "io-warn", "\u26A0");
  /* Одна подсказка на узел — и только `aria-label`: `title` рисует вторую. */
  const note = contrastWarning(ratio);
  warn.setAttribute("aria-label", note);
  return drawn;
}

/**
 * Таблица Values: девять колонок в порядке Ф7 — ручка, `Level`, `Value`,
 * `Prefix`, `Show`, `Fill`, `Text`, `Preview`, удаление. У Field типа `link`
 * колонок цвета нет: у ссылки нет своего цвета, остаются `Value` и `Prefix`.
 */
export function renderValuesTable(host: El, row: FieldRow, o: FieldsViewOpts): () => void {
  const say = words(o);
  const ve: ValuesEditor = o.model.valuesEditor(row.key);
  /* Один раз на таблицу: чтение темы — обращение к раскладке, и в цикле по
     значениям ему делать нечего. */
  const theme = themePair(host);
  const isLink = ve.kind === "wikilink";
  const closers: Array<() => void> = [];

  const head = el(host, "div", "io-sub io-item__namerow");
  el(head, "span", undefined, "Values");
  closers.push(tipBelow({
    head,
    host: el(host, "div", "io-tipslot"),
    text: say("VALUES_TIP"),
    label: "Values",
    id: "io-values-tip",
    showTips: o.showTips, showIds: o.showIds,
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
      showTips: o.showTips, showIds: o.showIds,
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
    grip.setAttribute("aria-label", say("VALUE_DRAG", v.token));
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
      label: say("VALUE_PREFIX_FOR", v.token),
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
        o.notice("A Prefix checkbox looks like [ ] or [I]");
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
        label: say("VALUE_SHOWN_FOR", v.token),
      });
      shown.disabled = !o.enabled;
      shown.addEventListener("change", (() => {
        if (!o.enabled) return;
        o.model.setValueVisual(fieldId, v.token, { visibility: shown.value as ValueVisibility },
          "pkm:visuals:tag:visibility:" + fieldId);
        o.redraw();
      }) as never);
      /*
       * Пузырь колонки `Preview` рисуется ниже, а нужен он обработчику выше —
       * поэтому ссылка, а не значение.
       */
      let previewBubble: El | null = null;
      if (visual.visibility === "custom") {
        const custom = textInput(shownCell, "io-text io-text--mono", {
          value: visual.customText,
          placeholder: "printed instead",
          label: say("VALUE_CUSTOM_FOR", v.token),
        });
        custom.disabled = !o.enabled;
        /*
         * `Preview` следует за набором, а конфиг — нет, и это разные события
         * намеренно (замечание заказчика 2026-09-07).
         *
         * `change` у поля ввода приходит по уходу фокуса или по `Enter`, и до
         * правки колонка `Preview` меняла подпись только после него — то есть
         * после перещёлкивания вкладок. Перерисовывать таблицу на каждую букву
         * нельзя: она унесёт каретку и скролл (У-20), а запись конфига на
         * каждую букву — это A9. Поэтому на `input` меняется **одна подпись
         * одного узла**, строит её то же правило, что и отрисовку, а в конфиг
         * значение уезжает по-прежнему на `change`.
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
          o.model.setValueVisual(fieldId, v.token, { customText: custom.value },
            "pkm:visuals:tag:custom-text:" + fieldId);
        }) as never);
      }

      const color = (key: "fillColor" | "textColor", label: string, reason: string): void => {
        const wrap = el(line, "div");
        /*
         * Пока своего цвета у Value нет, в образце стоит цвет **темы** — тот,
         * которым тема и рисует пузырь.
         *
         * Здесь стоял белый: у поля выбора цвета нет состояния «не задано», и
         * оно всегда показывает какой-то цвет. Белый образец рядом с пузырём,
         * который тема красит акцентом, читался как расхождение — заказчик
         * так его и прочёл (C31, C39). Цвет темы читается тем же помощником,
         * которым уже считается контраст незаданного цвета, и приводится к
         * `#rrggbb` тем же разбором (`toHexColor`), а не вторым своим.
         *
         * Белый остаётся последним запасным: у заглушки DOM темы нет, а
         * значение полю нужно всегда.
         */
        const own = key === "fillColor" ? visual.fillColor : visual.textColor;
        const fromTheme = toHexColor(key === "fillColor" ? theme.fill : theme.text);
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
      color("fillColor", "Fill color", "pkm:visuals:tag:fill");
      color("textColor", "Text color", "pkm:visuals:tag:text");

      previewBubble = previewCell(line, o, theme, {
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
          label: say("VALUE_RESET_COLORS", v.token),
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
  /* Решётка и двойные скобки не обязательны: значение читается одинаково с
     ними и без них (замечание заказчика 2026-08-27). */
  const add = textInput(foot, "io-text io-text--mono", {
    value: "",
    placeholder: isLink ? "[[wikilink]] / wikilink" : "#tag / tag",
    label: say("NEW_VALUE_FOR", row.strictName),
  });
  add.disabled = !o.enabled;
  /* Акцентная, как и `Add Field`: заказчик просил, чтобы её было видно. */
  const addBtn = btn(foot, "io-btn io-btn--sm io-btn--cta",
    { text: say("ADD_VALUE"), label: say("ADD_VALUE_TO", row.strictName) });
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

/**
 * Строки Field типа `element`: маркер, формат и то, чем он шагает. Значений у
 * такого Field нет — у него одно значение, которое команда умеет двигать.
 *
 * Строки стоят под своим заголовком, а не в общей куче под `Placement`:
 * заказчик читал их как настройки размещения (замечание 2026-08-27).
 */
export function renderElementRows(host: El, row: FieldRow, o: FieldsViewOpts): () => void {
  const say = words(o);
  const ed = o.model.elementEditor(row.key);
  const closers: Array<() => void> = [];

  const valueHead = el(host, "div", "io-sub io-item__namerow");
  el(valueHead, "span", undefined, "Value");
  closers.push(tipBelow({
    head: valueHead,
    host: el(host, "div", "io-tipslot"),
    text: say("ELEMENT_VALUE_TIP"),
    label: "Value",
    id: "io-element-value-tip",
    showTips: o.showTips, showIds: o.showIds,
  }));

  /** Строка с полем ввода. */
  const line = (name: string, desc: string, tip: string, tipId: string, value: string,
    placeholder: string, save: (v: string) => void): void => {
    const item = itemRow(host, { name, desc, tip, tipId, showTips: o.showTips, showIds: o.showIds });
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

  line(say("ELEMENT_EMOJI_NAME"), say("ELEMENT_EMOJI_DESC"), say("ELEMENT_EMOJI_TIP"), "io-element-marker-tip", ed.emoji,
    "one character or emoji", v => ed.setEmoji(v));
  line(say("ELEMENT_FORMAT_NAME"), say("ELEMENT_FORMAT_DESC"), say("ELEMENT_FORMAT_TIP"), "io-element-format-tip", ed.format,
    say("ELEMENT_FORMAT_HINT"), v => ed.setFormat(v));

  const steps = itemRow(host, {
    name: "Steps by",
    desc: say("ELEMENT_STEP_DESC"),
    tip: say("ELEMENT_STEP_TIP"),
    tipId: "io-element-step-tip",
    showTips: o.showTips, showIds: o.showIds,
  });
  closers.push(steps.closeTip);
  const mode = selectInput(steps.control, "io-select", {
    options: STEP_OPTIONS,
    value: ed.mode,
    label: say("ELEMENT_STEP_FOR", row.strictName),
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
    const cmd = itemRow(host, {
      name: "Command",
      desc: say("ELEMENT_COMMAND_DESC"),
      tip: say("ELEMENT_COMMAND_TIP"),
      tipId: "io-element-command-tip",
      showTips: o.showTips, showIds: o.showIds,
    });
    closers.push(cmd.closeTip);
    const pick = selectInput(cmd.control, "io-select", {
      options: [
        { value: "now", label: "The current date and time" },
        { value: "randomN", label: "Random numbers" },
        { value: "randomE", label: "Random characters" },
      ],
      value: ed.command,
      label: say("ELEMENT_COMMAND_FOR", row.strictName),
    });
    pick.disabled = !o.enabled;
    pick.addEventListener("change", (() => {
      if (!o.enabled) return;
      ed.setCommand(pick.value);
    }) as never);
  } else {
    const own = itemRow(host, {
      name: "Steps",
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
 * Редактор целиком. Таблица Values и строки `element` приезжают следующим
 * куском; до тех пор блок к панели не подключён, и полуготовый редактор
 * человек не видит: редактор без таблицы Values — это потеря доступа к
 * настройкам, а не промежуточное состояние.
 */
export function renderFieldsEditor(host: El, o: FieldsViewOpts): () => void {
  const say = words(o);
  const wrap = el(host, "div", "io-fields");
  const closers: Array<() => void> = [];

  const listCol = el(wrap, "div", "io-fields__col");
  const listHead = el(listCol, "div", "io-fields__colhead");
  el(listHead, "span", undefined, "Fields");
  closers.push(tipBelow({
    head: listHead,
    host: el(listCol, "div", "io-tipslot"),
    text: say("LIST_TIP"),
    label: "the Fields list",
    id: "io-fields-list-tip",
    showTips: o.showTips, showIds: o.showIds,
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
  const detailName = row && row.kind === "element" ? TYPE_LABEL.element : "Values";
  el(detailHead, "span", undefined, detailName);
  /*
   * «?» у шапки правой колонки. У левой он был с самого начала, у правой не
   * было вовсе, и заказчик заметил именно эту разницу (замечание 1.4.1.2.1).
   */
  closers.push(tipBelow({
    head: detailHead,
    host: el(detailCol, "div", "io-tipslot"),
    text: say("DETAIL_TIP"),
    label: "this column",
    id: "io-fields-detail-tip",
    showTips: o.showTips, showIds: o.showIds,
  }));
  const detail = el(detailCol, "div", "io-fields__detail");
  /* Ни одного Field — не ошибка, а приглашение (ПЗ2, ПЗ3). */
  if (row) closers.push(renderFieldDetail(detail, row, o));
  else el(detail, "div", "io-fields__hint", "add a Field on the left to set it up here");

  return () => {
    closers.forEach(fn => fn());
    wrap.remove();
  };
}
