/**
 * Минимум DOM для своих блоков (PRD 10, С5): без `obsidian` и браузера — гейты
 * Г16 и Г20 рисуют блоки на заглушке `tests/harness/dom_stub.ts`. Разметка
 * только узлами (З5), инлайн-стили — только `--io-*` (Г1), без цветовых
 * литералов (З6).
 */

import { richParts } from "../describe.ts";

export interface ElOpts {
  text?: string;
  cls?: string;
  attr?: Record<string, string>;
  /* `value` у option: иначе значение равно переводимой подписи. */
  /* Поля ввода: без `type` `createEl("input")` читается пустым. */
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
  /* Необязательные поля ниже заглушка гейтов может не завести. */
  /* Крестик поля, когда стирать нечего (В-131). */
  hidden?: boolean;
  /* Перенос подсказки к шапке; нет — остаётся, где положили. */
  insertBefore?(node: El, before: El | null): unknown;
  parentElement?: El | null;
  nextSibling?: El | null;
  /* Для свёрнутого субхедера: конец раздела — по соседям. */
  children?: { length: number; [index: number]: El };
  style: { setProperty(name: string, value: string): void };
  /** Классы состояния (перетаскивание: подсветка мимолётна, без перерисовки). */
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

/** Кнопка: `type="button"` (иначе отправит форму) и `aria-label` для значка. */
export function btn(parent: El, cls: string, o: {
  text?: string;
  label?: string;
  title?: string;
}): ElButton {
  /* Одна подсказка на узел (У-21): `title` не ставится — Obsidian показывает
     `aria-label`, и браузерный `title` всплыл бы второй коробкой. */
  const label = o.label ?? "";
  const full = o.title && o.title !== label
    ? (label ? label + " — " + o.title : o.title)
    : label;
  const attr: Record<string, string> = { type: "button" };
  if (full) attr["aria-label"] = full;
  return parent.createEl("button", { cls, text: o.text ?? "", attr }) as ElButton;
}

/** Однострочное поле; `aria-label` обязателен — подпись не `<label>`. */
export function textInput(parent: El, cls: string, o: {
  value: string;
  label: string;
  placeholder?: string;
  /** Обязательное поле (2026-09-22): красная рамка, пока пусто; снимается по `input`. */
  needed?: boolean;
}): ElInput {
  const opts: ElOpts = { cls, type: "text", value: o.value, attr: { "aria-label": o.label } };
  if (o.placeholder !== undefined) opts.placeholder = o.placeholder;
  const node = parent.createEl("input", opts) as ElInput;
  if (o.needed) markNeeded(node);
  return node;
}

/** Знак из выбиралки встаёт на место выделения поля; нет каретки — в конец (Н-11). */
export function insertAtCaret(input: ElInput, text: string): void {
  const at = input as unknown as { selectionStart?: number | null; selectionEnd?: number | null };
  const value = String(input.value || "");
  const from = typeof at.selectionStart === "number" ? at.selectionStart : value.length;
  const to = typeof at.selectionEnd === "number" ? at.selectionEnd : from;
  input.value = value.slice(0, from) + text + value.slice(to);
}

/** Enter в поле — то же, что кнопка рядом (BUGHUNT S3). */
export function onEnter(node: El, fn: () => void): void {
  node.addEventListener("keydown", ((e: { key?: string; preventDefault?: () => void }) => {
    if (!e || e.key !== "Enter") return;
    if (typeof e.preventDefault === "function") e.preventDefault();
    fn();
  }) as never);
}

/** Строка настройки внутри блока; своя — платформенный `Setting` рисует строку целиком. */
export function itemRow(host: El, o: {
  name: string;
  desc: string;
  tip?: string;
  tipId?: string;
  showTips: boolean;
  showIds?: boolean;
  /** Контрол во всю ширину под подписью: в ряд он мнёт описание. */
  stack?: boolean;
}): { control: El; info: El; row: El; closeTip: () => void } {
  const row = el(host, "div", "io-item" + (o.stack ? " io-item--stack" : ""));
  const info = el(row, "div", "io-item__info");
  const nameRow = el(info, "div", "io-item__namerow");
  el(nameRow, "div", "io-item__name", o.name);
  /*
   * Подсказка — в строке, а не в колонке описания, чтобы раскрываться во всю
   * ширину (`15.png`, 2026-09-07); перенос — `flex-wrap` у `.io-item`.
   */
  const closeTip = o.tip && o.tipId
    ? tipBelow({ head: nameRow, host: row, text: o.tip, label: o.name, id: o.tipId, showTips: o.showTips, showIds: o.showIds })
    : () => {};
  rich(el(info, "div", "io-item__desc"), o.desc);
  /* `info` наружу: предупреждение под описанием принадлежит строке (B21). */
  return { control: el(row, "div", "io-item__control"), info, row, closeTip };
}

/** Класс обязательного незаполненного поля. Одно имя на код и стили (У-103). */
export const NEEDED_CLASS = "io-text--needed";

/** Перекрасить рамку: значение, положенное кодом, событий `input`/`change` не даёт. */
export function paintNeeded(node: ElInput): void {
  if (!node.classList || typeof node.classList.add !== "function") return;
  if (String(node.value || "").trim()) node.classList.remove(NEEDED_CLASS);
  else node.classList.add(NEEDED_CLASS);
}

/** Обводка пустого поля; правило «пусто ли» одно на все поля (У-32). */
export function markNeeded(node: ElInput): void {
  const paint = (): void => { paintNeeded(node); };
  paint();
  node.addEventListener("input", paint as never);
  node.addEventListener("change", paint as never);
}

/** Галочка внутри `<label>`: щелчок по слову переключает, `aria-label` не нужен (У-21). */
export function checkInput(parent: El, cls: string, o: {
  label: string;
  /* Литералом, не склейкой: сторож каскада ищет имена в исходнике (У-65). */
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

/** Мини-разметка `<code>`/`<b>`; разбор общий с `describe.ts`. */
export function rich(host: El, text: string): El {
  for (const part of richParts(text)) {
    if (part.tag === "text") host.createSpan({ text: part.text });
    else host.createEl(part.tag, { text: part.text, cls: part.tag === "code" ? "io-code" : "" });
  }
  return host;
}

/**
 * Вычисленное значение CSS-переменной темы; пусто — нет `getComputedStyle`
 * (заглушка). Для контраста с цветом темы (2026-08-28); только чтение (З6).
 */
export function cssVarValue(node: El, name: string): string {
  try {
    const view = (globalThis as { window?: { getComputedStyle?: (n: unknown) => { getPropertyValue(p: string): string } } }).window;
    if (!view || typeof view.getComputedStyle !== "function") return "";
    const style = view.getComputedStyle(node);
    if (!style || typeof style.getPropertyValue !== "function") return "";
    return String(style.getPropertyValue(name) || "").trim();
  } catch {
    /* Проба: заглушка или узел вне дерева — считать нечего. */
    return "";
  }
}

/** Цвета темы для пузыря Value — один дом для редактора Fields и своих тегов (10.13.162). */
export interface ThemePair {
  fill: string;
  text: string;
  side: string;
  /** Текст на своей заливке, когда цвет текста не задан (`.io-bubble--filled`). */
  onFill: string;
}

export function themePair(node: El): ThemePair {
  return {
    /* Тег без своих цветов — как у темы (цикл 89); прозрачный фон пикер
       покажет белым. */
    fill: cssVarValue(node, "--tag-background"),
    text: cssVarValue(node, "--tag-color"),
    side: cssVarValue(node, "--tag-border-color"),
    onFill: cssVarValue(node, "--text-on-accent"),
  };
}

/** Значение CSS-переменной. Другие свойства свой блок не задаёт (Г1). */
export function cssVar(node: El, name: string, value: string): void {
  if (!name.startsWith("--io-")) throw new Error("свой блок задаёт только --io-*: " + name);
  node.style.setProperty(name, value);
}

/**
 * Подсказка своего блока (Ст12): «?» в шапке, тело под блоком — внутри рамки
 * она дёргает панель. Возвращает уборку открытой подсказки (С5).
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
  /** Тумблер `Show option IDs in tips` (10.13.5, A3, C52). */
  showIds?: boolean;
  /** Подпись «?»: `More about {0}` (10.13.47); нет — английская. */
  moreAbout?: string;
  /**
   * Подсказка сразу за шапкой, а не в конце хоста (2026-09-17): так делает
   * `attachTip` прототипа для предпросмотров (У-116, правило 41). У строки
   * настройки — под всей строкой.
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
    /* Перенос `insertBefore` отцепляет узел от прежнего места (У-45). */
    if (o.afterHead && typeof o.host.insertBefore === "function"
      && o.head.parentElement === o.host) {
      o.host.insertBefore(open, o.head.nextSibling || null);
    }
    rich(open, o.text);
    /* Id последней строкой, как у строки настройки; `-tip` снимается. */
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
  /** Свой стиль: браузер даёт `overflowY`, заглушка — только `getPropertyValue`. */
  style?: {
    overflowY?: string;
    overflow?: string;
    getPropertyValue?: (name: string) => string;
  };
}

/**
 * Ближайший прокручиваемый предок: туда первым ребёнком переезжает полоса
 * вкладок, иначе `sticky` ломает предок с `overflow` внутри списка платформы
 * (2026-09-02). Сначала вычисленный стиль (живой Obsidian), потом свой
 * (заглушка).
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
      } catch { /* проба: у заглушки вычисленного стиля нет */ }
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

/**
 * Выбор на нажатии, не на отпускании: выбиралка знака сворачивается по уходу
 * фокуса, форма съезжает, и `click` не рождается (стенд `new-field`, 2026-09-28).
 * `click` остаётся клавиатуре.
 */
export function onPress(node: El, fn: () => void): void {
  let pressed = false;
  node.addEventListener("pointerdown", (() => { pressed = true; fn(); }) as never);
  node.addEventListener("click", (() => { if (pressed) { pressed = false; return; } fn(); }) as never);
}

/** Ряд кнопок-переключателей: одна нажата. Узлы — свои, `aria-pressed` у каждой. */
export function segmented(host: El, options: ReadonlyArray<{ value: string; label: string }>, value: string,
  label: string, pick: (v: string) => void): void {
  const seg = el(host, "div", "io-seg");
  seg.setAttribute("role", "group");
  seg.setAttribute("aria-label", label);
  for (const o of options) {
    const b = btn(seg, "io-seg__btn" + (o.value === value ? " io-seg__btn--on" : ""), { text: o.label });
    b.setAttribute("aria-pressed", o.value === value ? "true" : "false");
    onPress(b, () => pick(o.value));
  }
}
