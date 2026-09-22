/**
 * Минимум DOM для своих блоков (PRD 10, С5).
 *
 * Блоки не импортируют `obsidian` и не знают про браузер: им хватает узла с
 * четырьмя операциями. Причина не в чистоте, а в проверках: гейты Г16 и Г20
 * рендерят каждый блок на заглушке `tests/harness/dom_stub.ts`, и блок,
 * который умеет только настоящий DOM, проверить нечем.
 *
 * Запреты, которые здесь соблюдаются за все блоки сразу: разметка только
 * узлами, без строк с тегами (З5); из инлайн-стилей — одни `--io-*` (Г1);
 * цветовых литералов нет (З6), цвет приходит из настройки или из темы.
 */

import { richParts } from "../describe.ts";

export interface ElOpts {
  text?: string;
  cls?: string;
  attr?: Record<string, string>;
  /* Значение пункта списка: `createEl("option")` без него даёт пункт,
     чьё значение равно подписи, а подпись мы переводим. */
  /* Поля ввода. Obsidian принимает их у `createEl` наравне с `cls` и `text`;
     без них `createEl("input")` выходит без типа, и любой ввод читается пустым. */
  value?: string;
  type?: string;
  placeholder?: string;
}

/** Узел, с которым работают свои блоки. */
export interface El {
  createEl(tag: string, o?: ElOpts): El;
  createDiv(o?: ElOpts): El;
  createSpan(o?: ElOpts): El;
  appendChild(child: El): unknown;
  empty(): void;
  addClass(...cls: string[]): void;
  setAttribute(name: string, value: string): void;
  addEventListener(type: string, fn: (ev: never) => void): void;
  remove(): void;
  textContent: string;
  tabIndex: number;
  /*
   * Спрятанный узел. Необязателен нарочно: заглушки узлов в гейтах его не
   * заводят, а спрашивают его ровно там, где он и ставится — у крестика,
   * который исчезает, когда стирать нечего (В-131).
   */
  hidden?: boolean;
  /*
   * Перестановка узла внутри родителя. Необязательны по той же причине, что и
   * `hidden`: заглушки узлов в гейтах их не заводят, а спрашивают их ровно
   * там, где переносят подсказку к шапке предпросмотра, и спрашивают у самого
   * узла — «нет» здесь означает «оставить, где положили».
   */
  insertBefore?(node: El, before: El | null): unknown;
  parentElement?: El | null;
  nextSibling?: El | null;
  /*
   * Соседи по родителю. Нужны ровно одному делу — свёрнутому субхедеру: его
   * раздел лежит в группе братьями, и конец раздела спрашивается у разметки.
   * Необязательны по той же причине, что `hidden`: заглушка узла в гейте их
   * может и не завести, и тогда раздела просто не видно как раздела.
   */
  children?: { length: number; [index: number]: El };
  style: { setProperty(name: string, value: string): void };
  /**
   * Классы состояния. Перетаскивание держит их на узле, а не в CSS-переменных:
   * подсветка строки под курсором живёт доли секунды и перерисовки не стоит.
   */
  classList: {
    add(...cls: string[]): void;
    remove(...cls: string[]): void;
    contains(cls: string): boolean;
  };
  /** Ручку перетаскивания несёт она сама, а не строка (Ф2). */
  draggable: boolean;
  /** Подсказка при наведении. Второй уровень объяснения живёт в `tip` (Ст12). */
  title: string;
}

/** Кнопка: у неё, в отличие от прочих узлов, бывает выключенное состояние. */
export interface ElButton extends El {
  disabled: boolean;
}

/** Поле ввода или выбор: у них есть значение. */
export interface ElInput extends El {
  value: string;
  disabled: boolean;
}

/** Галочка: у неё не значение, а положение. */
export interface ElCheck extends El {
  checked: boolean;
  disabled: boolean;
}

/** Событие перетаскивания в том виде, в каком его читают свои блоки. */
export interface DragEv {
  preventDefault(): void;
  stopPropagation(): void;
  dataTransfer?: {
    setData(format: string, data: string): void;
    getData(format: string): string;
    effectAllowed?: string;
  } | null;
}

/** Создать узел: тег, класс, текст, родитель — как в прототипе. */
export function el(parent: El | null, tag: string, cls?: string, text?: string): El {
  if (!parent) throw new Error("своему блоку нужен родитель: " + tag);
  const o: ElOpts = {};
  if (cls) o.cls = cls;
  if (text !== undefined) o.text = text;
  return parent.createEl(tag, o);
}

/**
 * Кнопка со всем, что нужно программе чтения с экрана. Отдельный помощник, а
 * не `el(...)`, по двум причинам: `type="button"` внутри формы иначе
 * отправляет её, а кнопка без `aria-label` со значком вместо текста читается
 * как «кнопка» и ничего больше.
 */
export function btn(parent: El, cls: string, o: {
  text?: string;
  label?: string;
  title?: string;
}): ElButton {
  /*
   * Одна подсказка на узел — и один атрибут, а не два одинаковых.
   *
   * Первая попытка (2026-08-27, четвёртый круг) сливала `label` и `title` в
   * одну строку и писала её в оба атрибута. Подсказок от этого осталось всё
   * равно две: `aria-label` показывает своей тёмной подсказкой Obsidian, а
   * `title` — браузер, светлой и поверх неё. Одинаковый текст ничего не
   * исправил, две коробки так и всплывали одна за другой (замечание
   * заказчика, пятый круг).
   *
   * Поэтому `title` не ставится вовсе. Подпись живёт в `aria-label`: её
   * читает и программа чтения с экрана, и подсказка Obsidian.
   */
  const label = o.label ?? "";
  const full = o.title && o.title !== label
    ? (label ? label + " — " + o.title : o.title)
    : label;
  const attr: Record<string, string> = { type: "button" };
  if (full) attr["aria-label"] = full;
  return parent.createEl("button", { cls, text: o.text ?? "", attr }) as ElButton;
}

/**
 * Однострочное поле ввода. `aria-label` обязателен: подпись у поля тут
 * отдельная строка, а не `<label>`, и без него программа чтения с экрана
 * читает «поле ввода» и ничего больше.
 */
export function textInput(parent: El, cls: string, o: {
  value: string;
  label: string;
  placeholder?: string;
  /**
   * Поле, без которого то, что человек настраивает, не работает вовсе (его
   * пункт 14, 2026-09-22): «я хочу, чтобы у всех обязательных настроек была
   * красная рамка… пока пользователь не вставит туда значение, затем она
   * должна меняться на обычный цвет». Пустое такое поле обводится сразу, и
   * рамка снимается на первом же знаке — не по `change`, а по `input`: ждать
   * ухода фокуса значит держать красное там, где уже всё написано.
   */
  needed?: boolean;
}): ElInput {
  const opts: ElOpts = { cls, type: "text", value: o.value, attr: { "aria-label": o.label } };
  if (o.placeholder !== undefined) opts.placeholder = o.placeholder;
  const node = parent.createEl("input", opts) as ElInput;
  if (o.needed) markNeeded(node);
  return node;
}

/** Класс обязательного незаполненного поля. Одно имя на код и стили (У-103). */
export const NEEDED_CLASS = "io-text--needed";

/**
 * Перекрасить рамку по нынешнему значению. Отдельно от `markNeeded` затем, что
 * значение, положенное кодом (выбиралка знака), событий `input` и `change` не
 * порождает, и рамка без этого вызова оставалась бы красной над знаком.
 */
export function paintNeeded(node: ElInput): void {
  if (!node.classList || typeof node.classList.add !== "function") return;
  if (String(node.value || "").trim()) node.classList.remove(NEEDED_CLASS);
  else node.classList.add(NEEDED_CLASS);
}

/**
 * Обвести поле, пока оно пустое, и снять обводку, как только в нём что-то
 * есть. Своё правило «пусто ли» тут одно на все такие поля: у каждого
 * второго оно разошлось бы с первым молча (У-32).
 */
export function markNeeded(node: ElInput): void {
  const paint = (): void => { paintNeeded(node); };
  paint();
  node.addEventListener("input", paint as never);
  node.addEventListener("change", paint as never);
}

/**
 * Галочка с подписью в одном узле `<label>`. Подпись внутри метки, а не рядом:
 * тогда нажатие по слову переключает её, и отдельный `aria-label` не нужен — одна
 * подпись на узел (У-21).
 */
export function checkInput(parent: El, cls: string, o: {
  label: string;
  /* Класс подписи приходит литералом, а не склейкой из `cls`: сторож каскада
     ищет имена классов в исходнике, и склеенное имя он не видит (У-65). */
  labelCls: string;
  checked: boolean;
}): ElCheck {
  const wrap = parent.createEl("label", { cls });
  const node = wrap.createEl("input", { type: "checkbox" }) as ElCheck;
  node.checked = o.checked === true;
  wrap.createEl("span", { cls: o.labelCls, text: o.label });
  return node;
}

/** Выбор из перечня. Значения — те, что лежат в конфиге; меняются подписи (З1). */
export function selectInput(parent: El, cls: string, o: {
  options: ReadonlyArray<{ value: string; label: string }>;
  value: string;
  label: string;
}): ElInput {
  const node = parent.createEl("select", { cls, attr: { "aria-label": o.label } }) as ElInput;
  for (const opt of o.options) node.createEl("option", { text: opt.label, value: opt.value });
  node.value = o.value;
  return node;
}

/**
 * Мини-разметка описаний в узле: `<code>` и `<b>`, остальное — текст.
 * Разбор общий с описаниями настроек (`describe.ts`), чтобы одна и та же
 * строка выглядела одинаково в строке настройки и внутри своего блока.
 */
export function rich(host: El, text: string): El {
  for (const part of richParts(text)) {
    if (part.tag === "text") host.createSpan({ text: part.text });
    else host.createEl(part.tag, { text: part.text, cls: part.tag === "code" ? "io-code" : "" });
  }
  return host;
}

/**
 * Значение CSS-переменной темы, как её видит браузер. Пусто — прочитать не
 * удалось: в заглушке DOM `getComputedStyle` нет, и это не ошибка.
 *
 * Нужна ровно для одного: посчитать контраст пары цветов, когда один из них
 * не задан человеком и приходит из темы (`--text-on-accent` у пузыря Value).
 * Без этого проверка контраста молчала именно там, где цвет опаснее всего —
 * белый текст на жёлтой заливке (замечание заказчика 2026-08-28).
 *
 * Цвет здесь только читается. Литералов не появляется, З6 в силе.
 */
export function cssVarValue(node: El, name: string): string {
  try {
    const view = (globalThis as { window?: { getComputedStyle?: (n: unknown) => { getPropertyValue(p: string): string } } }).window;
    if (!view || typeof view.getComputedStyle !== "function") return "";
    const style = view.getComputedStyle(node);
    if (!style || typeof style.getPropertyValue !== "function") return "";
    return String(style.getPropertyValue(name) || "").trim();
  } catch {
    /* Заглушка или узел вне дерева — считать нечего, и пугать значком нельзя. */
    return "";
  }
}

/**
 * Пара цветов темы для пузыря Value: заливка и текст на ней.
 *
 * Дом один, и он здесь — рядом с чтением переменной, из которой оба берутся.
 * Объявлений было два, в редакторе Fields и в таблице своих тегов, и тела
 * совпадали до знака. Мера копий их не видела: у объявления на TypeScript
 * открывающих скобок две, и разборщик тел брал за тело **возвращаемый тип**
 * (10.13.162).
 */
export interface ThemePair {
  fill: string;
  text: string;
}

export function themePair(node: El): ThemePair {
  return {
    fill: cssVarValue(node, "--interactive-accent"),
    text: cssVarValue(node, "--text-on-accent"),
  };
}

/** Значение CSS-переменной. Другие свойства свой блок не задаёт (Г1). */
export function cssVar(node: El, name: string, value: string): void {
  if (!name.startsWith("--io-")) throw new Error("свой блок задаёт только --io-*: " + name);
  node.style.setProperty(name, value);
}

/**
 * Подсказка второго уровня у своего блока (Ст12).
 *
 * `?` встаёт в шапку блока, а сама подсказка открывается **под** блоком.
 * Первая версия держала её внутри рамки на `details`: раскрытие раздвигало
 * текст коллаута, и панель читалась как прыгающая. У строки настройки такой
 * задачи нет — там подсказка и так под строкой, и `describe.ts` остаётся на
 * `details` без скриптов.
 *
 * Возвращает функцию, которая убирает открытую подсказку (С5).
 */
export function tipBelow(o: {
  /** Шапка блока: сюда встаёт «?». */
  head: El;
  /** Строка целиком: подсказка становится её последним ребёнком, то есть под блоком. */
  host: El;
  text: string;
  /** Для программы чтения с экрана: «More about …». */
  label: string;
  /** Связка кнопки и подсказки. */
  id: string;
  showTips: boolean;
  /**
   * Тумблер `Show option IDs in tips` (10.13.5). Подписи id стояли у всех
   * строк схемы и **ни у одной** подсказки своего блока: `Values`,
   * `Behavior`, `YAML property`, `Name in TagWheel`, предпросмотры,
   * `Color your Tags`. Заказчик называет элементы их id, и без подписи ему
   * приходилось объяснять словами, о чём речь (A3 и C52, 2026-09-02).
   */
  showIds?: boolean;
  /**
   * Подпись «?» с местом под имя строки: `More about {0}` (10.13.47).
   * Нет её — берётся английское, как было.
   */
  moreAbout?: string;
  /**
   * Поставить подсказку **сразу за шапкой**, а не последним ребёнком хоста.
   *
   * **Замечание заказчика 2026-09-17:** «tipbox открывается под preview, а не
   * над». Предпросмотр — это рамка, внутри которой картинка высотой в
   * несколько строк, и подсказка, приехавшая в самый низ, раскрывалась далеко
   * от того «?», на который он нажал.
   *
   * Прототип нормативен, и он так и делает: `attachTip` вставляет подсказку
   * `afterend` подписи, когда хост — не строка настройки. Панель приписывала
   * её в конец, и две отрисовки разошлись молча (У-116, правило 41). Здесь
   * панель приведена к прототипу, а не заведено третье правило.
   *
   * У строки настройки место прежнее: там подсказка и должна быть под всей
   * строкой, потому что колонка описания кончается раньше контрола.
   */
  afterHead?: boolean;
}): () => void {
  if (!o.text || !o.showTips) return () => {};

  let open: El | null = null;
  const mark = o.head.createEl("button", {
    cls: "io-help",
    text: "?",
    attr: {
      type: "button",
      "aria-expanded": "false",
      "aria-controls": o.id,
      "aria-label": (o.moreAbout || "More about {0}").replace("{0}", o.label),
    },
  });

  mark.addEventListener("click", () => {
    if (open) {
      open.remove();
      open = null;
      mark.setAttribute("aria-expanded", "false");
      return;
    }
    open = o.host.createEl("div", { cls: "io-tip io-tip--below", attr: { id: o.id } });
    /*
     * `createEl` кладёт узел последним ребёнком хоста; `afterHead` переносит
     * его к шапке. Перенос делается операцией платформы, отцепляющей узел от
     * прежнего места, — узел, вставленный вторым способом без отцепления,
     * остался бы в дереве дважды (У-45).
     */
    if (o.afterHead && typeof o.host.insertBefore === "function"
      && o.head.parentElement === o.host) {
      o.host.insertBefore(open, o.head.nextSibling || null);
    }
    rich(open, o.text);
    /*
     * Id последней строкой — так же, как у строки настройки. Имя берётся из
     * `id` подсказки: он стабилен, задан в коде рядом с самим элементом и
     * называет именно его. Хвост `-tip` снимается: он про подсказку, а
     * человеку нужен элемент.
     */
    if (o.showIds) {
      const name = o.id.replace(/-tip$/, "");
      if (name) open.createEl("div", { text: name, cls: "io-tip__id" });
    }
    mark.setAttribute("aria-expanded", "true");
  });

  return () => { if (open) { open.remove(); open = null; } };
}

/* ---- прокручиваемый предок (полоса вкладок, 10.13.13) ------------------ */

/** Узел в том виде, в каком его нужно осмотреть, чтобы найти прокрутку. */
export interface ScrollProbe {
  parentElement?: ScrollProbe | null;
  /**
   * Свой стиль узла. Читается двумя способами, потому что оба существуют:
   * в браузере у `style` есть и свойство `overflowY`, и
   * `getPropertyValue("overflow-y")`; заглушка DOM держит только второй.
   */
  style?: {
    overflowY?: string;
    overflow?: string;
    getPropertyValue?: (name: string) => string;
  };
}

/**
 * Ближайший прокручиваемый предок узла.
 *
 * Зачем. Полоса вкладок приклеена `position: sticky`, а он держится на том,
 * что между полосой и прокруткой нет предка с `overflow`, отличным от
 * `visible`. Полосу рисует строка `render`, то есть она лежит **внутри списка
 * платформы**, и что там за предки — из типов Obsidian не видно. Заказчик
 * написал, что полоса не приклеена (свободное замечание, 2026-09-02), и
 * проверить это из репозитория нечем: DOM живого окна здесь недостижим.
 *
 * Поэтому полоса переезжает первым ребёнком **самой прокрутки** — тогда
 * ломаться нечему. Найти её и есть задача этой функции.
 *
 * Порядок осмотра: сначала вычисленный стиль (в живом Obsidian `overflow`
 * задан таблицей стилей, а не атрибутом), потом собственный стиль узла — по
 * нему функцию можно проверить на заглушке.
 */
export function findScrollHost(node: ScrollProbe | null | undefined): ScrollProbe | null {
  const readStyle = (at: ScrollProbe): string => {
    const g = (globalThis as { getComputedStyle?: (n: unknown) => { overflowY?: string; overflow?: string } })
      .getComputedStyle;
    if (typeof g === "function") {
      try {
        const computed = g(at);
        const value = String((computed && (computed.overflowY || computed.overflow)) || "").trim();
        if (value) return value;
      } catch { /* у заглушки вычисленного стиля нет, и это не ошибка */ }
    }
    const own = at.style || {};
    if (typeof own.getPropertyValue === "function") {
      const byName = String(own.getPropertyValue("overflow-y") || own.getPropertyValue("overflow") || "").trim();
      if (byName) return byName;
    }
    return String(own.overflowY || own.overflow || "").trim();
  };

  let at: ScrollProbe | null | undefined = node && node.parentElement;
  while (at) {
    const overflow = readStyle(at);
    if (overflow === "auto" || overflow === "scroll" || overflow === "overlay") return at;
    at = at.parentElement;
  }
  return null;
}
